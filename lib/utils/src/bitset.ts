export type BitSet = Uint32Array

export const createBitSet = (sizeInBits: number): BitSet =>
    new Uint32Array(Math.ceil(sizeInBits / 32))

export const bitSetCapacity = (bs: BitSet) =>
    bs.byteLength * bs.BYTES_PER_ELEMENT

export const bitSetAdd = (bs: BitSet, id: number): void => {
    bs[id >> 5] |= 1 << (id & 31)
}

export const bitSetHas = (bs: BitSet, id: number): boolean => {
    if (id >= bitSetCapacity(bs)) return false
    return (bs[id >> 5] & (1 << (id & 31))) !== 0
}

export const bitSetRemove = (bs: BitSet, id: number): void => {
    bs[id >> 5] &= ~(1 << (id & 31))
}

export const bitSetGrow = (
    oldBs: Uint32Array,
    requiredSizeInBits: number,
): BitSet => {
    // Double the size or grow enough to fit the required index
    const newLength = Math.max(
        Math.ceil(requiredSizeInBits / 32) + 1,
        oldBs.length * 2,
    )
    const newBs = new Uint32Array(newLength)

    newBs.set(oldBs)

    return newBs
}
