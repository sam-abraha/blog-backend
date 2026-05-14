const {verifyToken} = require('../utils/jwt')

function authMiddleware(req,res,next) {
    try {
        const {token} = req.cookies
        
        if(!token) {
            return res.status(401).json({
                error: 'Unauthorized'
            })
        }
        const decoded = verifyToken(token)
        req.user = decoded
        next()

    }catch(error) {
        next(error)
    }
}

module.exports = {
    authMiddleware
}