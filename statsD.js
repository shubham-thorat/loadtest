import StatsD from 'node-statsd'

// var StatsD = require('node-statsd')
const client = new StatsD({
  host: 'localhost',
  port: 8125,
  prefix: 'websocket_client.'
});


client.socket.on('error', function (error) {
  // logger.error({
  //   "Nice": error
  // })
  console.error(JSON.stringify({
    "Error": error,
    "msg": "While connecting node-statsd"
  }))
});

export default client
