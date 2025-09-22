<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
      algorithm: 'AES-GCM',
    })

    getVault().then()

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

type VaultItemType = {
  id: number
  serviceName: string
  username: string
  cipherText: string
  notesCipher: string
  algorithm: string
  createdAt: string
  updatedAt: string
}
async function getVault() {
  const masterPassword = 'contraseñaMaestraDelUsuario'

  const respuesta = await axios.get<VaultItemType[]>(`/vault/${userId}`, {
    params: { algorithm: 'AES-GCM' },
  })

  const salt = 'salt123'
  const key = await deriveMasterKey(masterPassword, salt)

  const responsePromises = respuesta.data?.map(async (data) => {
    const cipher = JSON.parse(data.cipherText)
    const notesCipher = JSON.parse(data.notesCipher)

    const plainText = await decryptAESGCM(cipher.cipherText, cipher.iv, key)
    const notesText = await decryptAESGCM(notesCipher.cipherText, notesCipher.iv, key)

    return {
      ...data,
      cipherText: plainText,
      notesCipher: notesText,
    }
  })

  vaultItems.value = (await Promise.all(responsePromises)) ?? []
}

async function remove(id: number) {
  const confirm = window.confirm('Esta seguro')

  if (!confirm) return

  const response = await axios.delete(`/vault/${id}`)

  if (response?.data) {
    getVault().then()
  }
}

const vaultItems = ref<VaultItemType[]>()
onMounted(async () => {
  await getVault()
})
</script>

<template>
  <h1 style="text-align: center">Vista Cifrado Simétrico</h1>
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

    <hr style="margin-top: 1rem; margin-bottom: 1rem" />

    <div style="width: 100%">
      <h2>Baúl de Contraseñas</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Servicio</th>
            <th>Usuario</th>
            <th>Contraseña Cifrada</th>
            <th>Notas Cifradas</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="value in vaultItems" :key="value.id">
            <td>{{ value.id }}</td>
            <td>{{ value.serviceName }}</td>
            <td>{{ value.username }}</td>
            <td>{{ value.cipherText }}</td>
            <td>{{ value.notesCipher }}</td>
            <td>
              <button @click="remove(value.id)">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
th,
td {
  border: 1px solid #ccc;
  padding: 8px;
  text-align: left;
}
th {
  background-color: #f2f2f2;
}
</style>
