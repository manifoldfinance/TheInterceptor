import { addressString, checksummedAddress } from '../utils/bigint.js'
import { AddressInfoEntry, AddressBookEntry, AddressInfo, TokenEntry, NFTEntry } from '../utils/user-interface-types.js'
import { SimulationState, VisualizerResult } from '../utils/visualizer-types.js'
import { nftMetadata, tokenMetadata, contractMetadata } from '@darkflorist/address-metadata'
import { ethers } from 'ethers'
import { MOCK_ADDRESS } from '../utils/constants.js'
import { UserAddressBook } from '../utils/interceptor-messages.js'
import { getTokenDecimals } from '../simulation/services/SimulationModeEthereumClientService.js'
import { EthereumClientService } from '../simulation/services/EthereumClientService.js'
export const LOGO_URI_PREFIX = `../vendor/@darkflorist/address-metadata`

export function getFullLogoUri(logoURI: string) {
	return `${ LOGO_URI_PREFIX }/${ logoURI }`
}

export function findAddressInfo(address: bigint, addressInfos: readonly AddressInfo[] | undefined) : AddressInfoEntry{
	if (addressInfos !== undefined) {
		for (const info of addressInfos) {
			if (info.address === address) {
				return {
					...info,
					type: 'addressInfo'
				}
			}
		}
	}
	return {
		type: 'addressInfo' as const,
		name: checksummedAddress(address),
		address: address,
		askForAddressAccess: false,
	}
}

export function getAddressMetaData(address: bigint, userAddressBook: UserAddressBook) : AddressBookEntry {
	if ( address === MOCK_ADDRESS) {
		return {
			address: address,
			name: 'Ethereum Validator',
			logoUri: '../../img/contracts/rhino.png',
			type: 'contact',
		}
	}
	for (const info of userAddressBook.addressInfos) {
		if (info.address === address) {
			return {
				...info,
				type: 'addressInfo'
			}
		}
	}

	for (const contact of userAddressBook.contacts) {
		if (contact.address === address) {
			return {
				...contact,
				type: 'contact'
			}
		}
	}

	const addrString = addressString(address)

	const addressData = contractMetadata.get(addrString)
	if (addressData) return {
		...addressData,
		address: address,
		logoUri: addressData.logoUri ? `${ getFullLogoUri(addressData.logoUri) }` : undefined,
		type: 'other contract',
	}

	const tokenData = tokenMetadata.get(addrString)
	if (tokenData) return {
		...tokenData,
		address: address,
		logoUri: tokenData.logoUri ? `${ getFullLogoUri(tokenData.logoUri) }` : undefined,
		type: 'token',
	}

	const nftTokenData = nftMetadata.get(addrString)
	if (nftTokenData) return {
		...nftTokenData,
		address: address,
		logoUri: nftTokenData.logoUri ? `${ getFullLogoUri(nftTokenData.logoUri) }` : undefined,
		type: 'NFT'
	}

	return {
		address: address,
		name: ethers.getAddress(addrString),
		type: 'contact',
	}
}

export async function getTokenMetadata(ethereumClientService: EthereumClientService, address: bigint) : Promise<TokenEntry | NFTEntry> {
	const addrString = addressString(address)
	const tokenData = tokenMetadata.get(addrString)
	if (tokenData) return {
		...tokenData,
		address: address,
		logoUri: tokenData.logoUri ? `${ getFullLogoUri(tokenData.logoUri) }` : undefined,
		type: 'token',
	}
	const nftTokenData = nftMetadata.get(addrString)
	if (nftTokenData) return {
		...nftTokenData,
		address: address,
		logoUri: nftTokenData.logoUri ? `${ getFullLogoUri(nftTokenData.logoUri) }` : undefined,
		type: 'NFT',
	}
	const decimals = await getTokenDecimals(ethereumClientService, address).catch(() => {
		console.log(`could not fetch decimals for ${ address }`)
		return undefined
	})
	if (decimals !== undefined) {
		return {
			name: ethers.getAddress(addrString),
			address: BigInt(addrString),
			symbol: '???',
			decimals: decimals,
			type: 'token',
		}
	}
	return { //if we don't know decimals, assume it's NFT
		name: ethers.getAddress(addrString),
		address: BigInt(addrString),
		symbol: '???',
		type: 'NFT',
	}
}

export async function getAddressBookEntriesForVisualiser(ethereumClientService: EthereumClientService, visualizerResult: (VisualizerResult | undefined)[], simulationState: SimulationState, userAddressBook: UserAddressBook) : Promise<AddressBookEntry[]> {
	let addressesToFetchMetadata: bigint[] = []
	let tokenAddresses: bigint[] = []

	for (const vis of visualizerResult) {
		if (vis === undefined) continue
		const ethBalanceAddresses = vis.ethBalanceChanges.map( (x) => x.address )
		const from = vis.tokenResults.map( (x) => x.from )
		const to = vis.tokenResults.map( (x) => x.to )
		tokenAddresses = tokenAddresses.concat( vis.tokenResults.map( (x) => x.tokenAddress ) )
		addressesToFetchMetadata = addressesToFetchMetadata.concat(ethBalanceAddresses, from, to)
	}
	simulationState.simulatedTransactions.forEach( (tx) => {
		if ( tx.multicallResponse.statusCode === 'success') {
			addressesToFetchMetadata.concat(tx.multicallResponse.events.map( (tx) => tx.loggersAddress ))
		}
		addressesToFetchMetadata.push(tx.signedTransaction.from)
		if (tx.signedTransaction.to !== null) addressesToFetchMetadata.push(tx.signedTransaction.to)
	})

	const deDuplicatedTokens = Array.from(new Set<bigint>(tokenAddresses).values())
	const tokenPromises = deDuplicatedTokens.map ((addr) => getTokenMetadata(ethereumClientService, addr))
	const tokens = await Promise.all(tokenPromises)

	const deDuplicated = new Set<bigint>(addressesToFetchMetadata)
	const addresses: AddressBookEntry[] = Array.from(deDuplicated.values()).filter( (address) => !deDuplicatedTokens.includes(address) ).map( ( address ) =>
		getAddressMetaData(address, userAddressBook)
	)

	return addresses.concat(tokens)
}
