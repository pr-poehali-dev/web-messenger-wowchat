"""
Business: Chat management - create chats, get chat list, send/receive messages
Args: event with httpMethod, headers (X-Auth-Token), body, queryStringParameters
Returns: HTTP response with chats, messages or error
"""
import json
import os
import psycopg2
import jwt
from typing import Dict, Any, Optional

JWT_SECRET = os.environ.get('JWT_SECRET', 'wowchat-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

def get_db_connection():
    """Create database connection"""
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn)

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token and return payload"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except:
        return None

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle chat operations"""
    method: str = event.get('httpMethod', 'GET')
    
    # Handle CORS OPTIONS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    # Verify authentication
    headers = event.get('headers', {})
    token = headers.get('x-auth-token') or headers.get('X-Auth-Token')
    
    if not token:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Authentication required'})
        }
    
    user_data = verify_token(token)
    if not user_data:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid token'})
        }
    
    user_id = user_data['user_id']
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # GET CHATS LIST
        if method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            action = query_params.get('action')
            
            if action == 'messages':
                chat_id = query_params.get('chat_id')
                if not chat_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'chat_id required'})
                    }
                
                # Get messages for chat
                cur.execute("""
                    SELECT m.id, m.text, m.created_at, m.sender_id, u.username
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.chat_id = %s
                    ORDER BY m.created_at ASC
                    LIMIT 100
                """, (chat_id,))
                
                messages = []
                for row in cur.fetchall():
                    messages.append({
                        'id': row[0],
                        'text': row[1],
                        'timestamp': row[2].isoformat(),
                        'sender_id': row[3],
                        'sender_username': row[4]
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'messages': messages})
                }
            
            else:
                # Get user's chats with last message
                cur.execute("""
                    SELECT DISTINCT 
                        c.id, 
                        c.name,
                        c.is_group_chat,
                        (SELECT u2.username FROM users u2 
                         JOIN chat_members cm2 ON cm2.user_id = u2.id 
                         WHERE cm2.chat_id = c.id AND u2.id != %s LIMIT 1) as other_username,
                        (SELECT m.text FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                        (SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time
                    FROM chats c
                    JOIN chat_members cm ON cm.chat_id = c.id
                    WHERE cm.user_id = %s
                    ORDER BY last_message_time DESC NULLS LAST
                """, (user_id, user_id))
                
                chats = []
                for row in cur.fetchall():
                    chat_name = row[1] if row[2] else (row[3] or 'Unknown')
                    chats.append({
                        'id': row[0],
                        'name': chat_name,
                        'is_group': row[2],
                        'last_message': row[4],
                        'last_message_time': row[5].isoformat() if row[5] else None
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'chats': chats})
                }
        
        # CREATE CHAT OR SEND MESSAGE
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            if action == 'create_chat':
                other_user_id = body_data.get('user_id')
                if not other_user_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'user_id required'})
                    }
                
                # Check if chat already exists
                cur.execute("""
                    SELECT c.id FROM chats c
                    JOIN chat_members cm1 ON cm1.chat_id = c.id
                    JOIN chat_members cm2 ON cm2.chat_id = c.id
                    WHERE c.is_group_chat = false
                    AND cm1.user_id = %s
                    AND cm2.user_id = %s
                """, (user_id, other_user_id))
                
                existing = cur.fetchone()
                if existing:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'chat_id': existing[0]})
                    }
                
                # Create new chat
                cur.execute("INSERT INTO chats (is_group_chat) VALUES (false) RETURNING id")
                chat_id = cur.fetchone()[0]
                
                # Add members
                cur.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (%s, %s), (%s, %s)",
                           (chat_id, user_id, chat_id, other_user_id))
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'chat_id': chat_id})
                }
            
            elif action == 'send_message':
                chat_id = body_data.get('chat_id')
                text = body_data.get('text', '').strip()
                
                if not chat_id or not text:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'chat_id and text required'})
                    }
                
                # Insert message
                cur.execute(
                    "INSERT INTO messages (chat_id, sender_id, text) VALUES (%s, %s, %s) RETURNING id, created_at",
                    (chat_id, user_id, text)
                )
                result = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'message_id': result[0],
                        'timestamp': result[1].isoformat()
                    })
                }
            
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid action'})
                }
        
        else:
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Method not allowed'})
            }
    
    finally:
        cur.close()
        conn.close()
