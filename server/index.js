import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.static(join(__dirname, '..', 'dist')))
app.listen(4217, '127.0.0.1', () => console.log('skill-manager on http://127.0.0.1:4217'))
