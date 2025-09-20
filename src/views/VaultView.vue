<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'

axios.defaults.baseURL = 'http://127.0.0.1:3000'

// Datos del formulario
const serviceName = ref('')
const username = ref('')
const password = ref('')
const notes = ref('')

const userId = 1

async function deriveMasterKey(masterPassword: string, salt: string) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

async function encryptAESGCM(plainText: string, key: CryptoKey) {
  const enc = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText),
  )

  const cipherArray = new Uint8Array(cipherBuffer)
  const cipherText = btoa(String.fromCharCode(...cipherArray))
  const ivB64 = btoa(String.fromCharCode(...iv))
  return JSON.stringify({ cipherText, iv: ivB64 })
}

async function submitVaultItem() {
  try {
    const salt = 'salt123'

    const masterKey = await deriveMasterKey('contraseñaMaestraDelUsuario', salt)

    const cipherText = await encryptAESGCM(password.value, masterKey)
    const notesCipher = notes.value ? await encryptAESGCM(notes.value, masterKey) : undefined

    await axios.post(`/vault/${userId}`, {
      serviceName: serviceName.value,
      username: username.value,
      cipherText,
      notesCipher,
      algorithm: 'AES-256-GCM',
    })

    alert('VaultItem guardado!')

    serviceName.value = ''
    username.value = ''
    password.value = ''
    notes.value = ''
  } catch (error) {
    console.error(error)
    alert('Error al guardar VaultItem')
  }
}

async function decryptAESGCM(cipherTextB64: string, ivB64: string, key: CryptoKey) {
  function b64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }

  const cipherBytes = b64ToBytes(cipherTextB64) as BufferSource
  const iv = b64ToBytes(ivB64) as BufferSource

  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes)

  return new TextDecoder().decode(plainBuffer)
}

async function getVault() {
  const masterPassword = 'contraseñaMaestraDelUsuario'

  const respuesta = await axios.get(`/vault/${userId}`)

  const data = respuesta.data[0]
  const salt = 'salt123'

  const key = await deriveMasterKey(masterPassword, salt)

  const cipher = JSON.parse(data.cipherText)

  const plainText = await decryptAESGCM(cipher.cipherText, cipher.iv, key)
  console.log('Contenido del vault:', plainText)
}

getVault().then()
</script>

<template>
  <div class="vault-form">
    <h2>Agregar nueva contraseña</h2>
    <form @submit.prevent="submitVaultItem">
      <div>
        <label for="">Servicio</label>
        <input v-model="serviceName" required />
      </div>
      <div>
        <label>Usuario</label>
        <input v-model="username" required />
      </div>
      <div>
        <label>Contraseña</label>
        <input v-model="password" type="password" required />
      </div>
      <div>
        <label>Notas (opcional)</label>
        <textarea v-model="notes"></textarea>
      </div>
      <button type="submit">Guardar</button>
    </form>
  </div>
</template>

<style scoped>
.vault-form {
  max-width: 400px;
  margin: 0 auto;
}
.vault-form div {
  margin-bottom: 10px;
}
</style>
