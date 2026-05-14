const {verifyToken} = require('../utils/jwt')
const {userRepository} = require('../repositories/userRepository')

async function authMiddleware(req,res,next) {
    try {
        const {token} = req.cookies
        
        if(!token) {
            return res.status(401).json({
                error: 'Unauthorized'
            })
        }
        const decoded = verifyToken(token)
        const user = await userRepository.findById(decoded.id) // fetch user from db
        
        if(!user) {
            return res.status(401).json({
                error: 'User not found'
            })
        }
        req.user = user
        next()

    }catch(error) {
        next(error)
    }
}

module.exports = authMiddleware;