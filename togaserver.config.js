module.exports = {
    apps:[
        {
            name: 'togaserver',
            script: './dist/index.js',
            instances: 1,
            autorestart: true,

            max_memory_restart: '500M',

            watch: false,

            // out_file:
            error_file: './log/pm2/err.log',
        }
    ]
}