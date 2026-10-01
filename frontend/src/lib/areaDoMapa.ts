/**
 * Área coberta pelo arquivo de tiles (public/mapa/algodoal.pmtiles, scripts/gerar-mapa.sh):
 * da Ilha de Maiandeua até Marudá. Mesmos valores do backend (app/schemas/admin.py), que recusa
 * local fora dela — ele não apareceria no mapa.
 */
export const OESTE = -47.68
export const SUL = -0.66
export const LESTE = -47.51
export const NORTE = -0.56

const br = (n: number) => n.toFixed(2).replace('.', ',')

export function erroDeLatitude(latitude: number): string | null {
  return latitude >= SUL && latitude <= NORTE
    ? null
    : `Fora da área do mapa: a latitude precisa ficar entre ${br(SUL)} e ${br(NORTE)}. ` +
        'Com esta coordenada o local não apareceria no mapa.'
}

export function erroDeLongitude(longitude: number): string | null {
  return longitude >= OESTE && longitude <= LESTE
    ? null
    : `Fora da área do mapa: a longitude precisa ficar entre ${br(OESTE)} e ${br(LESTE)}. ` +
        'Com esta coordenada o local não apareceria no mapa.'
}
