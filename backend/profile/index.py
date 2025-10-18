"""
Business: VneChat profile management - update profile, change email, delete account
Args: event with httpMethod, headers (X-Auth-Token), body
Returns: HTTP response with updated profile or success status
"""
import json
import os
import psycopg2
import jwt
import bcrypt
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

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle profile operations"""
    method: str = event.get('httpMethod', 'GET')
    
    # Handle CORS OPTIONS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
        # GET PROFILE
        if method == 'GET':
            cur.execute(
                """SELECT id, username, first_name, last_name, email, avatar_url, status, online, created_at
                   FROM users WHERE id = %s""",
                (user_id,)
            )
            user = cur.fetchone()
            
            if not user:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'User not found'})
                }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'id': user[0],
                    'username': user[1],
                    'first_name': user[2],
                    'last_name': user[3],
                    'email': user[4],
                    'avatar_url': user[5],
                    'status': user[6],
                    'online': user[7],
                    'created_at': user[8].isoformat() if user[8] else None
                })
            }
        
        # UPDATE PROFILE
        elif method == 'PUT':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action', 'update_profile')
            
            if action == 'update_profile':
                first_name = body_data.get('first_name', '').strip()
                last_name = body_data.get('last_name', '').strip()
                status = body_data.get('status', '').strip()
                avatar_url = body_data.get('avatar_url', '').strip()
                
                if not first_name or not last_name:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'First name and last name are required'})
                    }
                
                cur.execute(
                    """UPDATE users 
                       SET first_name = %s, last_name = %s, status = %s, avatar_url = %s
                       WHERE id = %s
                       RETURNING id, username, first_name, last_name, email, avatar_url, status""",
                    (first_name, last_name, status, avatar_url if avatar_url else None, user_id)
                )
                user = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'id': user[0],
                        'username': user[1],
                        'first_name': user[2],
                        'last_name': user[3],
                        'email': user[4],
                        'avatar_url': user[5],
                        'status': user[6]
                    })
                }
            
            elif action == 'change_email':
                new_email = body_data.get('email', '').strip().lower()
                password = body_data.get('password', '')
                
                if not new_email or not password:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Email and password are required'})
                    }
                
                # Verify password
                cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
                user = cur.fetchone()
                if not user or not verify_password(password, user[0]):
                    return {
                        'statusCode': 401,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Invalid password'})
                    }
                
                # Check if email already exists
                cur.execute("SELECT id FROM users WHERE email = %s AND id != %s", (new_email, user_id))
                if cur.fetchone():
                    return {
                        'statusCode': 409,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Email already exists'})
                    }
                
                # Update email
                cur.execute("UPDATE users SET email = %s WHERE id = %s", (new_email, user_id))
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True, 'email': new_email})
                }
            
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid action'})
                }
        
        # DELETE ACCOUNT
        elif method == 'DELETE':
            body_data = json.loads(event.get('body', '{}'))
            password = body_data.get('password', '')
            
            if not password:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Password required'})
                }
            
            # Verify password
            cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            if not user or not verify_password(password, user[0]):
                return {
                    'statusCode': 401,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid password'})
                }
            
            # Mark user as deleted (update email and username to free them up)
            cur.execute(
                """UPDATE users 
                   SET email = %s, username = %s, online = false, first_name = 'Deleted', last_name = 'User'
                   WHERE id = %s""",
                (f'deleted_{user_id}@vnechat.deleted', f'deleted_{user_id}', user_id)
            )
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True})
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
