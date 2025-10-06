import crypto from 'crypto';
import 'dotenv/config';

const ALGORITHM = 'aes-256-cbc';
const SECRET = process.env.KEY_ENCRYPTION_SECRET || 'change_me_in_prod';

// derive 32 bytes key
const KEY = crypto.createHash('sha256').update(SECRET).digest();

export function encryptKey(plain) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let enc = cipher.update(plain, 'utf8', 'hex');
  enc += cipher.final('hex');
  return `${iv.toString('hex')}:${enc}`;
}

export function decryptKey(encrypted) {
  if (!encrypted) throw new Error('No encrypted key provided');
  const [ivHex, cipherHex] = encrypted.split(':');
  if (!ivHex || !cipherHex) throw new Error('Invalid encrypted key format');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(cipherHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let dec = decipher.update(encryptedText, null, 'utf8');
  dec += decipher.final('utf8');
  return dec;
}
