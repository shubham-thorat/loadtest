import * as fs from 'fs';
import addToJSON from '../calculator.js'

/**
 * Result of a load test.
 */
export class Result {
	constructor() {
		this.url = null
		this.cores = 0
		this.maxRequests = 0
		this.maxSeconds = 0
		this.concurrency = 0
		this.agent = null
		this.requestsPerSecond = null
		this.clients = 0
		this.startTimeMs = Number.MAX_SAFE_INTEGER
		this.stopTimeMs = 0
		this.elapsedSeconds = 0
		this.totalRequests = 0
		this.totalErrors = 0
		this.totalTimeSeconds = 0
		this.accumulatedMs = 0
		this.maxLatencyMs = 0
		this.minLatencyMs = Number.MAX_SAFE_INTEGER
		this.errorCodes = {}
		this.histogramMs = {}
	}

	compute(latency) {
		const options = latency.options
		this.url = options.url
		this.cores = options.cores
		this.maxRequests = parseInt(options.maxRequests)
		this.maxSeconds = parseInt(options.maxSeconds)
		this.concurrency = parseInt(options.concurrency)
		this.clients = latency.clients
		if (options.tcp) {
			this.agent = 'tcp'
		} else if (options.agentKeepAlive) {
			this.agent = 'keepalive'
		} else {
			this.agent = 'none'
		}
		this.requestsPerSecond = parseInt(options.requestsPerSecond)
		this.startTimeMs = Number(latency.startTimeNs / 1000000n)
		this.stopTimeMs = Number(latency.stopTimeNs / 1000000n)
		this.totalRequests = latency.totalRequests
		this.totalErrors = latency.totalErrors
		this.accumulatedMs = latency.totalTime
		this.maxLatencyMs = latency.maxLatencyMs
		this.minLatencyMs = latency.minLatencyMs
		this.errorCodes = latency.errorCodes
		this.histogramMs = latency.histogramMs
		this.computeDerived()
	}

	computeDerived() {
		this.elapsedSeconds = (this.stopTimeMs - this.startTimeMs) / 1000
		this.totalTimeSeconds = this.elapsedSeconds // backwards compatibility
		const meanTime = this.accumulatedMs / this.totalRequests
		this.meanLatencyMs = Math.round(meanTime * 10) / 10
		this.effectiveRps = Math.round(this.totalRequests / this.elapsedSeconds)
		this.rps = this.effectiveRps // backwards compatibility
		this.computePercentiles()
	}

	computePercentiles() {
		this.percentiles = {
			50: false,
			90: false,
			95: false,
			99: false
		};
		let counted = 0;

		for (let ms = 0; ms <= this.maxLatencyMs; ms++) {
			if (!this.histogramMs[ms]) {
				continue;
			}
			counted += this.histogramMs[ms];
			const percent = counted / this.totalRequests * 100;

			Object.keys(this.percentiles).forEach(percentile => {
				if (!this.percentiles[percentile] && percent > percentile) {
					this.percentiles[percentile] = ms;
				}
			});
		}
	}

	combine(result) {
		// configuration
		this.url = this.url || result.url
		this.cores += 1
		this.maxRequests += result.maxRequests
		this.maxSeconds = this.maxSeconds || result.maxSeconds
		this.concurrency = this.concurrency || result.concurrency
		this.agent = this.agent || result.agent
		this.requestsPerSecond += result.requestsPerSecond || 0
		this.clients += result.clients
		// result
		this.startTimeMs = Math.min(this.startTimeMs, result.startTimeMs)
		this.stopTimeMs = Math.max(this.stopTimeMs, result.stopTimeMs)
		this.totalRequests += result.totalRequests
		this.totalErrors += result.totalErrors
		this.accumulatedMs += result.accumulatedMs
		this.maxLatencyMs = Math.max(this.maxLatencyMs, result.maxLatencyMs)
		this.minLatencyMs = Math.min(this.minLatencyMs, result.minLatencyMs)
		this.combineMap(this.errorCodes, result.errorCodes)
		this.combineMap(this.histogramMs, result.histogramMs)
		this.computeDerived()
	}

	combineMap(originalMap, addedMap) {
		for (const key in {...originalMap, ...addedMap}) {
			if (!originalMap[key]) {
				originalMap[key] = 0
			}
			if (addedMap[key]) {
				originalMap[key] += addedMap[key]
			}
		}
	}

	/**
	 * Show result of a load test.
	 */
	show() {
		let data = {
			'machine':'c5.xlarge',
			"maxRequests":this.maxRequests,
			'concurrency':(this.clients/this.cores),
			'cores':this.cores,
			'concurrentClients':this.clients,
			'agent':this.agent,
			'completedRequests':this.totalRequests,
			'errors':this.totalErrors,
			'totalTime':this.elapsedSeconds * 1000,
			'meanLatency':this.meanLatencyMs,
			'effectiveRPS':this.effectiveRps,
			'effectiveRPSPerClient': (this.effectiveRps/this.clients).toFixed(3),
		}
		function writeToFile(message) {
			console.log(message)
			// fs.appendFile('output.txt', message + '\n', (err) => {
			// 	if (err) throw err;
			// });
		}
		writeToFile('');
		writeToFile(`Target URL:          ${this.url}`);
		if (this.maxRequests) {
			writeToFile(`Max requests:        ${this.maxRequests}`);
		} else if (this.maxSeconds) {
			writeToFile(`Max time (s):        ${this.maxSeconds}`);
		}
		if (this.requestsPerSecond) {
			writeToFile(`Target rps:          ${this.requestsPerSecond}`);
		}
		writeToFile(`Concurrent clients:  ${this.clients}`)
		if (this.cores) {
			writeToFile(`Running on cores:    ${this.cores}`);
		}
		writeToFile(`Agent:               ${this.agent}`);
		writeToFile('');
		writeToFile(`Completed requests:  ${this.totalRequests}`);
		writeToFile(`Total errors:        ${this.totalErrors}`);
		writeToFile(`Total time:          ${this.elapsedSeconds} s`);
		writeToFile(`Mean latency:        ${this.meanLatencyMs} ms`);
		writeToFile(`Effective rps:       ${this.effectiveRps}`);
		writeToFile('');
		writeToFile('Percentage of requests served within a certain time');

		Object.keys(this.percentiles).forEach(percentile => {
			writeToFile(`  ${percentile}%      ${this.percentiles[percentile]} ms`);
			data[`${percentile}th_percentile`] = this.percentiles[percentile]
		});

		writeToFile(` 100%      ${this.maxLatencyMs} ms (longest request)`);
		data['100th_percentile'] = this.maxLatencyMs
		if (this.totalErrors) {
			writeToFile('');
			Object.keys(this.errorCodes).forEach(errorCode => {
				const padding = ' '.repeat(errorCode.length < 4 ? 4 - errorCode.length : 1);
				writeToFile(` ${padding}${errorCode}:   ${this.errorCodes[errorCode]} errors`);
			});
		}

		console.log("\nOUTPUT : ",data)
		addToJSON(data)
	}
}

