"""
Business: VneChat messenger operations - chats, messages, contacts, call history
Args: event with httpMethod, headers (X-Auth-Token), body, queryStringParameters
Returns: HTTP response with chats, messages, contacts or error
"""
import json
import os
import psycopg2
import jwt
from typing import Dict, Any, Optional

JWT_SECRET = os.environ.get('JWT_SECRET', 'vnechat-secret-key-change-in-production')
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
    """Handle messenger operations"""
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
        # GET REQUESTS
        if method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            action = query_params.get('action')
            
            # GET CONTACTS
            if action == 'contacts':
                cur.execute("""
                    SELECT u.id, u.username, u.first_name, u.last_name, u.avatar_url, u.status, u.online, u.last_seen
                    FROM users u
                    JOIN contacts c ON c.contact_user_id = u.id
                    WHERE c.user_id = %s
                    ORDER BY u.first_name, u.last_name
                """, (user_id,))
                
                contacts = []
                for row in cur.fetchall():
                    contacts.append({
                        'id': row[0],
                        'username': row[1],
                        'first_name': row[2],
                        'last_name': row[3],
                        'avatar_url': row[4],
                        'status': row[5],
                        'online': row[6],
                        'last_seen': row[7].isoformat() if row[7] else None
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'contacts': contacts})
                }
            
            # GET CALL HISTORY
            elif action == 'calls':
                cur.execute("""
                    SELECT 
                        c.id, c.call_type, c.status, c.duration, c.started_at,
                        c.caller_id, u1.username as caller_username, u1.first_name as caller_first, u1.last_name as caller_last, u1.avatar_url as caller_avatar,
                        c.receiver_id, u2.username as receiver_username, u2.first_name as receiver_first, u2.last_name as receiver_last, u2.avatar_url as receiver_avatar
                    FROM calls c
                    JOIN users u1 ON c.caller_id = u1.id
                    JOIN users u2 ON c.receiver_id = u2.id
                    WHERE c.caller_id = %s OR c.receiver_id = %s
                    ORDER BY c.started_at DESC
                    LIMIT 50
                """, (user_id, user_id))
                
                calls = []
                for row in cur.fetchall():
                    is_outgoing = row[5] == user_id
                    other_user = {
                        'id': row[10] if is_outgoing else row[5],
                        'username': row[11] if is_outgoing else row[6],
                        'first_name': row[12] if is_outgoing else row[7],
                        'last_name': row[13] if is_outgoing else row[8],
                        'avatar_url': row[14] if is_outgoing else row[9]
                    }
                    
                    calls.append({
                        'id': row[0],
                        'type': row[1],
                        'status': row[2],
                        'duration': row[3],
                        'timestamp': row[4].isoformat(),
                        'is_outgoing': is_outgoing,
                        'other_user': other_user
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'calls': calls})
                }
            
            # GET MESSAGES
            elif action == 'messages':
                chat_id = query_params.get('chat_id')
                if not chat_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'chat_id required'})
                    }
                
                cur.execute("""
                    SELECT m.id, m.text, m.created_at, m.sender_id, u.username, u.first_name, u.last_name, u.avatar_url
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
                        'sender': {
                            'username': row[4],
                            'first_name': row[5],
                            'last_name': row[6],
                            'avatar_url': row[7]
                        }
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'messages': messages})
                }
            
            # GET CHATS (default)
            else:
                cur.execute("""
                    SELECT DISTINCT 
                        c.id, 
                        c.name,
                        c.is_group_chat,
                        (SELECT u2.id FROM users u2 
                         JOIN chat_members cm2 ON cm2.user_id = u2.id 
                         WHERE cm2.chat_id = c.id AND u2.id != %s LIMIT 1) as other_user_id,
                        (SELECT u2.username FROM users u2 
                         JOIN chat_members cm2 ON cm2.user_id = u2.id 
                         WHERE cm2.chat_id = c.id AND u2.id != %s LIMIT 1) as other_username,
                        (SELECT u2.first_name FROM users u2 
                         JOIN chat_members cm2 ON cm2.user_id = u2.id 
                         WHERE cm2.chat_id = c.id AND u2.id != %s LIMIT 1) as other_first_name,
                        (SELECT u2.last_name FROM users u2 
                         JOIN chat_members cm2 ON cm2.user_id = u2.id 
                         WHERE cm2.chat_id = c.id AND u2.id != %s LIMIT 1) as other_last_name,
                        (SELECT u2.avatar_url FROM users u2 
                         JOIN chat_members cm2 ON cm2.user_id = u2.id 
                         WHERE cm2.chat_id = c.id AND u2.id != %s LIMIT 1) as other_avatar,
                        (SELECT u2.online FROM users u2 
                         JOIN chat_members cm2 ON cm2.user_id = u2.id 
                         WHERE cm2.chat_id = c.id AND u2.id != %s LIMIT 1) as other_online,
                        (SELECT m.text FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                        (SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time
                    FROM chats c
                    JOIN chat_members cm ON cm.chat_id = c.id
                    WHERE cm.user_id = %s
                    ORDER BY last_message_time DESC NULLS LAST
                """, (user_id, user_id, user_id, user_id, user_id, user_id, user_id))
                
                chats = []
                for row in cur.fetchall():
                    chat_name = row[1] if row[2] else f"{row[5]} {row[6]}" if row[5] else 'Unknown'
                    chats.append({
                        'id': row[0],
                        'name': chat_name,
                        'is_group': row[2],
                        'other_user': {
                            'id': row[3],
                            'username': row[4],
                            'first_name': row[5],
                            'last_name': row[6],
                            'avatar_url': row[7],
                            'online': row[8]
                        } if not row[2] else None,
                        'last_message': row[9],
                        'last_message_time': row[10].isoformat() if row[10] else None
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'chats': chats})
                }
        
        # POST REQUESTS
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            # ADD CONTACT
            if action == 'add_contact':
                contact_username = body_data.get('username', '').strip()
                if not contact_username:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'username required'})
                    }
                
                # Find user
                cur.execute("SELECT id FROM users WHERE username = %s", (contact_username,))
                contact_user = cur.fetchone()
                if not contact_user:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'User not found'})
                    }
                
                # Add contact
                try:
                    cur.execute("INSERT INTO contacts (user_id, contact_user_id) VALUES (%s, %s)", (user_id, contact_user[0]))
                    conn.commit()
                except:
                    return {
                        'statusCode': 409,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Contact already exists'})
                    }
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True})
                }
            
            # CREATE CHAT
            elif action == 'create_chat':
                other_user_id = body_data.get('user_id')
                if not other_user_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'user_id required'})
                    }
                
                # Check if chat exists
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
                
                cur.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (%s, %s), (%s, %s)",
                           (chat_id, user_id, chat_id, other_user_id))
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'chat_id': chat_id})
                }
            
            # SEND MESSAGE
            elif action == 'send_message':
                chat_id = body_data.get('chat_id')
                text = body_data.get('text', '').strip()
                
                if not chat_id or not text:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'chat_id and text required'})
                    }
                
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
            
            # LOG CALL
            elif action == 'log_call':
                receiver_id = body_data.get('receiver_id')
                call_type = body_data.get('call_type', 'audio')
                status = body_data.get('status', 'completed')
                duration = body_data.get('duration', 0)
                
                if not receiver_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'receiver_id required'})
                    }
                
                cur.execute(
                    """INSERT INTO calls (caller_id, receiver_id, call_type, status, duration, ended_at) 
                       VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP) RETURNING id""",
                    (user_id, receiver_id, call_type, status, duration)
                )
                call_id = cur.fetchone()[0]
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'call_id': call_id})
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
