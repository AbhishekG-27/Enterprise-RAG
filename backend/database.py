import aiosqlite
import uuid
import json
from typing import List, Dict, Optional
from datetime import datetime

DATABASE_PATH = "chat_history.db"

async def init_db():
    """
    Create tables if they don't exist. Called once at FastAPI startup.

    WHY at startup: We need the tables to exist before any request hits.
    Using FastAPI's @app.on_event("startup") ensures this runs once.
    """
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT DEFAULT 'New Chat',
                file_uuid TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_conversation
                ON messages(conversation_id, created_at)
        """)
        await db.commit()


async def create_conversation(file_uuid: Optional[str] = None) -> str:
    """
    Create a new conversation session. Returns the conversation UUID.

    WHY return UUID: The frontend needs this ID to associate subsequent
    messages with this conversation. It stores it in React state and sends
    it with every query.
    """
    conversation_id = str(uuid.uuid4())
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "INSERT INTO conversations (id, file_uuid) VALUES (?, ?)",
            (conversation_id, file_uuid)
        )
        await db.commit()
    return conversation_id


async def add_message(
    conversation_id: str,
    role: str,
    content: str,
    sources: Optional[List[Dict]] = None
) -> str:
    """
    Add a message to a conversation. Returns the message UUID.

    WHY store both human and assistant messages: We need the full alternating
    sequence (human, assistant, human, assistant, ...) to reconstruct the
    conversation history for the LLM prompt.

    WHY store sources as JSON: Sources are a complex nested structure (content,
    metadata, score). JSON serialization is the simplest way to store them in
    SQLite without creating additional tables.
    """
    message_id = str(uuid.uuid4())
    sources_json = json.dumps(sources) if sources else None

    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "INSERT INTO messages (id, conversation_id, role, content, sources) VALUES (?, ?, ?, ?, ?)",
            (message_id, conversation_id, role, content, sources_json)
        )
        # Update conversation's updated_at and title (from first human message)
        await db.execute(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (conversation_id,)
        )
        # Auto-set title from first human message
        if role == "human":
            existing = await db.execute(
                "SELECT COUNT(*) FROM messages WHERE conversation_id = ? AND role = 'human'",
                (conversation_id,)
            )
            count = (await existing.fetchone())[0]
            if count == 1:  # This is the first human message (just inserted)
                title = content[:50] + ("..." if len(content) > 50 else "")
                await db.execute(
                    "UPDATE conversations SET title = ? WHERE id = ?",
                    (title, conversation_id)
                )
        await db.commit()
    return message_id


async def get_conversation_messages(
    conversation_id: str,
    limit: Optional[int] = None
) -> List[Dict]:
    """
    Retrieve messages for a conversation, ordered by creation time.

    WHY optional limit: For the LLM prompt, we may only want the last N
    messages (see Section 7: Token Budget). For the frontend chat display,
    we want all messages.

    Returns list of dicts: [{"role": "human", "content": "..."}, ...]
    """
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        if limit:
            # Get the last `limit` messages (subquery to get them in correct order)
            cursor = await db.execute(
                """SELECT role, content, sources, created_at FROM messages
                   WHERE conversation_id = ?
                   ORDER BY created_at DESC LIMIT ?""",
                (conversation_id, limit)
            )
            rows = await cursor.fetchall()
            rows = list(reversed(rows))  # Reverse to chronological order
        else:
            cursor = await db.execute(
                """SELECT role, content, sources, created_at FROM messages
                   WHERE conversation_id = ?
                   ORDER BY created_at ASC""",
                (conversation_id,)
            )
            rows = await cursor.fetchall()

        return [
            {
                "role": row["role"],
                "content": row["content"],
                "sources": json.loads(row["sources"]) if row["sources"] else None,
                "created_at": row["created_at"]
            }
            for row in rows
        ]


async def list_conversations(file_uuid: Optional[str] = None) -> List[Dict]:
    """
    List all conversations, optionally filtered by file.

    WHY ordered by updated_at DESC: Most recently active conversations
    appear first—standard chat app behavior.
    """
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        if file_uuid:
            cursor = await db.execute(
                """SELECT id, title, file_uuid, created_at, updated_at
                   FROM conversations WHERE file_uuid = ?
                   ORDER BY updated_at DESC""",
                (file_uuid,)
            )
        else:
            cursor = await db.execute(
                """SELECT id, title, file_uuid, created_at, updated_at
                   FROM conversations ORDER BY updated_at DESC"""
            )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def delete_conversation(conversation_id: str) -> bool:
    """
    Delete a conversation and all its messages (CASCADE).

    WHY expose this: Users should be able to clear conversation history.
    GDPR/privacy compliance also requires deletion capability.
    """
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Enable foreign keys for CASCADE to work
        await db.execute("PRAGMA foreign_keys = ON")
        cursor = await db.execute(
            "DELETE FROM conversations WHERE id = ?",
            (conversation_id,)
        )
        await db.commit()
        return cursor.rowcount > 0

async def _conversation_exists(conversation_id: str) -> bool:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute(
            "SELECT 1 FROM conversations WHERE id = ?", (conversation_id,)
        )
        return (await cursor.fetchone()) is not None