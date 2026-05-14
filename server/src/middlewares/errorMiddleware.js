function errorMiddleware(req,res,next, err) {
    console.log(err)
    res.status(500).json({
        message: err.message || 'internal server error'
    })
}

module.exports = errorMiddleware;