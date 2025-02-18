export function areEqual(first?: Uint8Array, second?: Uint8Array) {
	if (first === undefined) return second === undefined
	if (second === undefined) return first === undefined
	if (first.length !== second.length) return false
	return first.every((value, index) => value === second[index])
}

export function stripLeadingZeros(byteArray: Uint8Array): Uint8Array {
	let i = 0
	for (; i < byteArray.length; ++i) {
		if (byteArray[i] !== 0) break
	}
	const result = new Uint8Array(byteArray.length - i)
	for (let j = 0; j < result.length; ++j) {
		result[j] = byteArray[i + j]
	}
	return result
}

export function arrayToChunks<Type>(array: readonly Type[], chunkSize: number) {
	return Array.from(
		{ length: Math.ceil(array.length / chunkSize) }, (_, i) => array.slice(i * chunkSize, i * chunkSize + chunkSize)
	)
}
