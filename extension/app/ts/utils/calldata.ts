import { ethers } from 'ethers'
import { dataStringWith0xStart } from './bigint.js'
import * as funtypes from 'funtypes'
import { EthereumAddress, EthereumQuantity } from './wire-types.js'

const ABI = [
	'function transfer(address to, uint256 value) public returns (bool success)',
	'function transferFrom(address from, address to, uint256 value) public returns (bool success)',
	'function approve(address spender, uint256 value) public returns (bool success)',
	'function setApprovalForAll(address operator, bool approved)',
]

type CallDataType = funtypes.Static<typeof CallDataType>
const CallDataType = funtypes.Union(
	funtypes.Object({
		name: funtypes.Literal('transfer'),
		arguments: funtypes.Object({
			to: EthereumAddress,
			value: EthereumQuantity,
		})
	}),
	funtypes.Object({
		name: funtypes.Literal('transferFrom'),
		arguments: funtypes.Object({
			from: EthereumAddress,
			to: EthereumAddress,
			value: EthereumQuantity,
		})
	}),
	funtypes.Object({
		name: funtypes.Literal('approve'),
		arguments: funtypes.Object({
			spender: EthereumAddress,
			value: EthereumQuantity,
		})
	}),
	funtypes.Object({
		name: funtypes.Literal('setApprovalForAll'),
		arguments: funtypes.Object({
			operator: EthereumAddress,
			approved: funtypes.Boolean,
		})
	}),
)

export function parseTransaction(transaction: { input?: Uint8Array, from: bigint }) {
	if (!('input' in transaction) || transaction.input === undefined || transaction.input.length < 4) return undefined
	const iface = new ethers.Interface(ABI)
	const parsed = iface.parseTransaction({ data: dataStringWith0xStart(transaction.input) })
	if (parsed === null) return undefined
	return CallDataType.parse({
		name: parsed.name,
		arguments: parsed?.args,
	})
}

export function get4Byte(data: Uint8Array) {
	if (data.buffer.byteLength < 4) return undefined // always calls fallback method
	return new DataView(data.buffer, 0, 4).getUint32(0)
}
