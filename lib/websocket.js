import websocket from 'websocket'
import { BaseClient } from './baseClient.js'

import schemapack from 'schemapack'
// import client from '../statsD.js';

let latency;

const enable_schemapack = true;

const schema = schemapack.build({
	ts: 'string',
	c: 'uint32',
	txnTyp: 'string',
	exch: 'string',
	qty: 'uint32',
	sym: 'string',
	prc: 'float32',
	odTyp: 'string',
	tag: 'string',
	source: 'string',
	mktType: 'string',
	val: 'string',
	segmt: 'string',
	trprc: 'float32',
	var: 'string',
	pdt: 'string',
	disqty: 'int16',
	tarprc: 'float32',
	start:'string',
	received:'string'
});

/**
 * A client that connects to a websocket.
 */
var failedCounter = 0;
var connectCounter = 0
var startCounter = 0
export class WebsocketClient extends BaseClient {
	constructor(loadTest) {
		super(loadTest);
		this.latency = loadTest.latency
		this.connection = null;
		this.lastCall = null;
		this.client = null;
		this.init();
	}

	/**
	 * Start the websocket client.
	 */
	start() {
		// console.log("CPU USAGE : ",process.cpuUsage())
		startCounter += 1
		this.client = new websocket.client();
		this.client.on('connectFailed', () => {
			failedCounter += 1
			console.error(`**** Websocket connection failed ${failedCounter}****`)
		 });
		this.client.on('connect', connection => {
			connectCounter += 1
			console.error(`**** Websocket connection connect ${connectCounter}****`)
			return this.connect(connection)
		});


		console.log(`**** Websocket connection start ${startCounter}****`)
		this.client.connect(this.options.url, []);
	}

	/**
	 * Stop the websocket client.
	 */
	stop() {
		if (this.connection) {
			this.connection.close();
		}
	}

	/**
	 * Connect the player.
	 */
	connect(localConnection) {
		this.connection = localConnection;

		this.makeRequest();
	}

	/**
	 * Make a single request to the server.
	 */
	makeRequest() {
		const id = this.latency.begin();
		const requestFinished = this.getRequestFinisher(id);

		if (this.connection.connected) {
			let ended = false;


			// NOTE: there are no per-request callbacks (and no notion of request/response)
			// in the websockets package.  So we can't support requestsPerSecond; everything must
			// be synchronous per connection.

			this.connection.on('error', error => {
				if (ended) return;
				ended = true;
				requestFinished('Connection error: ' + error);
			});

			this.connection.on('close', () => {
				if (ended) return;
				ended = true;
				requestFinished('Connection closed ');
			});

			this.connection.on('message', message => {
				if (ended) return;
				ended = true;
				
				// client.timing('response_received', 1)

				// if (message.type != 'utf8') {
					// 	console.error('Invalid message type ' + message.type);
					// 	return;
					// }
					let json;
					//console.log('message', message);
					try {
						if (enable_schemapack) {
							json = schema.decode(message.binaryData);
						} else {
							json = JSON.parse(message.utf8Data);
						}
						
					}
					catch (e) {
						console.error('Invalid JSON: ' + message.utf8Data);
						return;
					}
					// console.log("data: ",json)
					// let finish = Date.now()
					// client.timing('response_time',finish - parseInt(json['start']))
					// client.timing('client_to_server_time', parseInt(json['received']) - parseInt(json['start']))
					// client.timing('server_to_client_time', finish - parseInt(json['received']))

				// eat the client_connected message we get at the beginning
				if ((json && json[0] && json[0][0] == 'client_connected')) {
					ended = false;
					return;
				}

				if (this.lastCall) {
					const newCall = new Date().getTime();
					latency.add(newCall - this.lastCall);
					this.lastCall = null;
				}

				requestFinished(null, json);
			});

			let message = { some: "message" };

			if (this.generateMessage) {
				message = this.generateMessage(id);
			}
			if (typeof this.options.requestGenerator == 'function') {
				// create a 'fake' object which can function like the http client
				const req = () => {
					return {
						write: message => {
							// this.connection.send({
							//
							// });
							this.connection.sendUTF(message);
						}
					};
				};
				this.options.requestGenerator(this.options, this.params, req, requestFinished);
			} else {
				//console.log('message', message);
				message = {
					ts: 'string',
					c: 1,
					txnTyp: 'string',
					exch: 'string',
					qty: 1,
					sym: 'string',
					prc: 1.01,
					odTyp: 'string',
					tag: 'string',
					source: 'string',
					mktType: 'string',
					val: 'string',
					segmt: 'string',
					trprc: 1.50,
					var: 'string',
					pdt: 'string',
					disqty: 1,
					tarprc: 1.11,
					'start':Date.now().toString(),
					'received':'0',
					'finish':'0'
				};
				
				// client.timing('request_send', 1)
				if (enable_schemapack) {
					this.connection.send(schema.encode(message))
				} else {
					this.connection.sendUTF(JSON.stringify(message));
				}
			}
		}
	}
}

