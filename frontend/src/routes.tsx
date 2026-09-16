import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { CarrocaPage } from './pages/CarrocaPage'
import { DiretorioPage } from './pages/DiretorioPage'
import { MapaPage } from './pages/MapaPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PassaportePage } from './pages/PassaportePage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <MapaPage /> },
      { path: 'diretorio', element: <DiretorioPage /> },
      { path: 'carroca', element: <CarrocaPage /> },
      { path: 'passaporte', element: <PassaportePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
