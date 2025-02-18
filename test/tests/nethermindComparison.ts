import { EthereumClientService } from '../../app/ts/simulation/services/EthereumClientService.js'
import { appendTransaction, getSimulatedBlock, getSimulatedTransactionByHash } from '../../app/ts/simulation/services/SimulationModeEthereumClientService.js'
import { CHAINS } from '../../app/ts/utils/constants.js'
import { GetBlockReturn, EthereumSignedTransactionWithBlockData, JsonRpcResponse, EthereumJsonRpcRequest } from '../../app/ts/utils/wire-types.js'
import { eth_getBlockByNumber_goerli_8443561_false, eth_getBlockByNumber_goerli_8443561_true, eth_multicall_failure, eth_transactionByhash0xe10c2a85168046080235fff99e2e14ef1e90c8cf5e9d675f2ca214e49e555e0f } from '../nethermindRPCResponses.js'
import { describe, should } from '../micro-should.js'
import * as assert from 'assert'
import { assertIsObject } from '../../app/ts/utils/typescript.js'

function parseRequest(data: string) {
	const jsonRpcResponse = JsonRpcResponse.parse(JSON.parse(data))
	if ('error' in jsonRpcResponse) throw Error(`Ethereum Client Error: ${ jsonRpcResponse.error.message }`)
	return jsonRpcResponse.result
}

class MockEthereumJSONRpcRequestHandler {
	constructor(_endpoint: string) {}

	public readonly jsonRpcRequest = async (rpcRequest: EthereumJsonRpcRequest) => {
		switch (rpcRequest.method) {
			case 'eth_getBlockByNumber': {
				if (rpcRequest.params[0] !== 8443561n && rpcRequest.params[0] !== 'latest') throw new Error('Unsupported block number')
				if (rpcRequest.params[1] === true) return parseRequest(eth_getBlockByNumber_goerli_8443561_true)
				return parseRequest(eth_getBlockByNumber_goerli_8443561_false)
			}
			case 'eth_multicall': return parseRequest(eth_multicall_failure)
			case 'eth_getTransactionByHash': {
				if (rpcRequest.params[0] === 0xe10c2a85168046080235fff99e2e14ef1e90c8cf5e9d675f2ca214e49e555e0fn) {
					return parseRequest(eth_transactionByhash0xe10c2a85168046080235fff99e2e14ef1e90c8cf5e9d675f2ca214e49e555e0f)
				}
				throw new Error(`unsupprted Hash`)
			}
		}
	}
}

export async function main() {
	const blockNumber = 8443561n
	const chain = '5' as const
	const ethereum = new EthereumClientService(new MockEthereumJSONRpcRequestHandler(CHAINS[chain].https_rpc), chain, () => {}, () => {})
	const simulationState = {
		prependTransactionsQueue: [],
		simulatedTransactions: [],
		blockNumber: blockNumber,
		blockTimestamp: new Date(0),
		chain: chain,
		simulationConductedTimestamp: new Date(0),
	}

	const exampleTransaction = {
		type: '1559',
		from: 0xd8da6bf26964af9d7eed9e03e53415d37aa96045n,
		nonce: 0n,
		maxFeePerGas: 1n,
		maxPriorityFeePerGas: 1n,
		gas: 21000n,
		to: 0xda9dfa130df4de4673b89022ee50ff26f6ea73cfn,
		value: 10n,
		input: new Uint8Array(0),
		chainId: 5n,
	} as const

	describe('Nethermind testing', () => {

		should('getBlock with true aligns with Nethermind', async () => {
			const block = await getSimulatedBlock(ethereum, simulationState, blockNumber, true)
			const serialized = GetBlockReturn.serialize(block)
			const expected = parseRequest(eth_getBlockByNumber_goerli_8443561_true)
			assertIsObject(expected)
			assert.equal(JSON.stringify(serialized, Object.keys(block).sort()), JSON.stringify(expected, Object.keys(expected).sort()))
		})

		should('getBlock with false aligns with Nethermind', async () => {
			const block = await getSimulatedBlock(ethereum, simulationState, blockNumber, false)
			const serialized = GetBlockReturn.serialize(block)
			const expected = parseRequest(eth_getBlockByNumber_goerli_8443561_false)
			assertIsObject(expected)
			assert.equal(JSON.stringify(serialized, Object.keys(block).sort()), JSON.stringify(expected, Object.keys(expected).sort()))
		})

		should('adding transaction and getting the next block should include all the same fields as Nethermind', async () => {
			const block = await getSimulatedBlock(ethereum, simulationState, blockNumber, true)
			const newState = await appendTransaction(ethereum, simulationState, { transaction: exampleTransaction, website: { websiteOrigin: 'test', icon: undefined, title: undefined }, transactionCreated: new Date(), transactionSendingFormat: 'eth_sendTransaction' })
			const nextBlock = await getSimulatedBlock(ethereum, newState, blockNumber + 1n, true)
			assert.equal(JSON.stringify(Object.keys(nextBlock).sort()), JSON.stringify(Object.keys(block).sort()))

			const expected = parseRequest(eth_getBlockByNumber_goerli_8443561_true)
			assertIsObject(expected)
			const requiredFields = Object.keys(expected).sort()
			assert.equal(JSON.stringify(Object.keys(nextBlock).sort()), JSON.stringify(requiredFields))
		})

		should('get transaction by hash aligns with Nethermind', async () => {
			const transaction = await getSimulatedTransactionByHash(ethereum, simulationState, 0xe10c2a85168046080235fff99e2e14ef1e90c8cf5e9d675f2ca214e49e555e0fn)
			if (transaction === undefined) throw new Error('Transaction is undefined')

			const serialized = EthereumSignedTransactionWithBlockData.serialize(transaction)
			const expected = parseRequest(eth_transactionByhash0xe10c2a85168046080235fff99e2e14ef1e90c8cf5e9d675f2ca214e49e555e0f)
			assertIsObject(expected)
			assertIsObject(serialized)
			assert.equal(JSON.stringify(serialized, Object.keys(serialized).sort()), JSON.stringify(expected, Object.keys(expected).sort()))
		})
	})
}
