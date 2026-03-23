const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'potachat_secret_key'

module.exports = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET)
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ message: 'Invalid token' })
  }
}
