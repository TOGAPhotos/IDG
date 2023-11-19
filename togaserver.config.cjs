module.exports = {
    apps:[
        {
            name: 'togaserver',
            script: './dist/index.js',
            autorestart: true,

            exec_mode:"fork",
            max_memory_restart: '500M',

            watch: false,
        }
    ]
}