<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'

axios.defaults.baseURL = 'http://127.0.0.1:3000'

// Datos del formulario
const serviceName = ref('')
const username = ref('')
const password = ref('')
const notes = ref('')
const publicKeyFile = ref<File>()
const privateKeyFile = ref<File>()

const userId = 1

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
const vaultItems = ref<VaultItemType[]>()

async function getPublicKey() {
  if (!publicKeyFile.value) {
    alert('Debes seleccionar un archivo de clave pública')
    return
  }

  const pem = await publicKeyFile.value.text()

  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '')

  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

  // 3️⃣ Importar clave pública
  const key = await window.crypto.subtle.importKey(
    'spki',
    der.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )

  return key
}

async function getPrivateKey() {
  if (!privateKeyFile.value) {
    alert('Debes seleccionar un archivo de clave privada')
    return
  }

  const pem = await privateKeyFile.value.text()

  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')

  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

  const key = await window.crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  )

  return key
}

async function encryptData(plainText: string) {
  const publicKey: CryptoKey | undefined = await getPublicKey()
  if (!publicKey) {
    return
  }
  const enc = new TextEncoder().encode(plainText)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP', iv }, publicKey, enc)

  const cipherArray = new Uint8Array(cipher)
  const cipherText = btoa(String.fromCharCode(...cipherArray))
  const ivB64 = btoa(String.fromCharCode(...iv))
  return JSON.stringify({ cipherText, iv: ivB64 })
}

async function decryptData(cipherTextB64: string, ivB64: string, privateKey: CryptoKey) {
  function b64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }

  const cipherBytes = b64ToBytes(cipherTextB64) as BufferSource
  const iv = b64ToBytes(ivB64) as BufferSource

  const plainBuffer = await crypto.subtle.decrypt({ name: 'RSA-OAEP', iv }, privateKey, cipherBytes)

  return new TextDecoder().decode(plainBuffer)
}

async function submitVaultItem() {
  try {
    const cipherText = await encryptData(password.value)
    const notesCipher = notes.value ? await encryptData(password.value) : undefined

    await axios.post(`/vault/${userId}`, {
      serviceName: serviceName.value,
      username: username.value,
      cipherText,
      notesCipher,
      algorithm: 'RSA-OAEP',
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

async function getVault() {
  const respuesta = await axios.get<VaultItemType[]>(`/vault/${userId}`, {
    params: { algorithm: 'RSA-OAEP' },
  })

  const privateKey = await getPrivateKey()
  if (!privateKey) {
    return (vaultItems.value = respuesta.data)
  }

  const responsePromises = respuesta.data?.map(async (data) => {
    const cipher = JSON.parse(data.cipherText)
    const notesCipher = JSON.parse(data.notesCipher)

    const plainText = await decryptData(cipher.cipherText, cipher.iv, privateKey).catch((e) => e)
    const notesText = await decryptData(notesCipher.cipherText, notesCipher.iv, privateKey).catch(
      (e) => e,
    )

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

onMounted(() => {
  getVault().then()
})
</script>

<template>
  <h1 style="text-align: center">Vista Cifrado Asimétrico</h1>
  <div class="flex">
    <strong>Llave Publica: </strong>
    <input
      type="file"
      @change="
        (e) => {
          const target = e.target as HTMLInputElement
          publicKeyFile = target.files?.[0]
        }
      "
    />
  </div>

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

    <div class="flex">
      <strong>Llave Privada: </strong>
      <input
        type="file"
        @change="
          (e) => {
            const target = e.target as HTMLInputElement
            privateKeyFile = target.files?.[0]

            getVault().then()
          }
        "
      />
    </div>

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
            <td style="word-break: break-all">{{ value.cipherText }}</td>
            <td style="word-break: break-all">{{ value.notesCipher }}</td>
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
