const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`API ${response.status} em ${path}`)
  return response.json() as Promise<T>
}
