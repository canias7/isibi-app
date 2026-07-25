const API = '/api/db/' + (location.pathname.split('/')[2] || '')

const TOKEN_KEY = 'isibi_site_token'

export const store = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY) || ''
    } catch {
      return ''
    }
  },
  set: (token) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {}
  },
}

async function request(path, { method = 'GET', body, auth = false, headers = {} } = {}) {
  const finalHeaders = { 'Content-Type': 'application/json', ...headers }
  if (auth) {
    const token = store.get()
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`
  }
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    let data = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`)
      err.status = res.status
      err.code = data && data.code
      err.data = data
      throw err
    }
    return data
  } catch (e) {
    if (e && e.status) throw e
    const err = new Error('Network error — please check your connection and try again.')
    err.cause = e
    throw err
  }
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  base: API,
}

export default api