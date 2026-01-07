declare module 'tweetnacl-sealedbox-js' {
  function seal(message: Uint8Array, publicKey: Uint8Array): Uint8Array
  function open(
    ciphertext: Uint8Array,
    publicKey: Uint8Array,
    secretKey: Uint8Array
  ): Uint8Array | null
  export { seal, open }
  export default { seal, open }
}

declare module 'tweetnacl-util' {
  function decodeUTF8(s: string): Uint8Array
  function encodeUTF8(arr: Uint8Array): string
  function decodeBase64(s: string): Uint8Array
  function encodeBase64(arr: Uint8Array): string
  export { decodeUTF8, encodeUTF8, decodeBase64, encodeBase64 }
  export default { decodeUTF8, encodeUTF8, decodeBase64, encodeBase64 }
}
