import { LiveTVRepository } from '../repositories/LiveTVRepository.js'
import { MoviesRepository } from '../repositories/MoviesRepository.js'
import { SeriesRepository } from '../repositories/SeriesRepository.js'

function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ])
}

export async function preloadApplicationData() {
  console.log("[Preloader] Iniciando sincronización en segundo plano...")

  const names = [
    "LiveTV Categories",
    "LiveTV Streams",
    "Movies Categories",
    "Movies List",
    "Series Categories",
    "Series List"
  ]

  const tasks = [
    withTimeout(LiveTVRepository.syncCategories()),
    withTimeout(LiveTVRepository.syncStreams()),
    withTimeout(MoviesRepository.syncCategories()),
    withTimeout(MoviesRepository.syncMoviesList()),
    withTimeout(SeriesRepository.syncCategories()),
    withTimeout(SeriesRepository.syncSeriesList())
  ]

  const results = await Promise.allSettled(tasks)

  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      console.log(`[Preloader] ${names[i]} sincronizado correctamente.`)
    } else {
      console.warn(`[Preloader] ${names[i]} falló:`, res.reason)
    }
  })

  console.log("[Preloader] Sincronización terminada. Datos listos para acceso instantáneo.")
}