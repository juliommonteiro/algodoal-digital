"""Geografia do catálogo inicial do seed: o mapa abre no zoom 14 sobre a vila, e a maior parte
dos locais tem de estar ali. A conferência de "nada na água" é feita contra o arquivo de tiles
(frontend/public/mapa/algodoal.pmtiles), que não está no container do backend."""

import math

from scripts.seed import PLACES

# Mesmos valores do frontend (src/components/mapa/estilo.ts)
VILA = (-0.59219, -47.58609)  # "Algodoal" (place/locality) no arquivo de tiles
TRAPICHE = (-0.59999, -47.58714)  # ferry_terminal "Algodoal" no arquivo de tiles
RECORTE = {"oeste": -47.68, "sul": -0.66, "leste": -47.51, "norte": -0.56}

# Área visível no zoom 14 com o mapa de 358x464 px (tela de 390x844), menos 24 px de folga
# na borda (meio marcador). Escala do MapLibre: 512 * 2^z pixels por volta de 360 graus.
PX_POR_GRAU = 512 * 2**14 / 360
MEIA_LARGURA = (358 / 2 - 24) / PX_POR_GRAU
MEIA_ALTURA = (464 / 2 - 24) / PX_POR_GRAU


def coordenadas(definicao: dict) -> tuple[float, float]:
    return float(definicao["latitude"]), float(definicao["longitude"])


def visivel_no_zoom_14(lat: float, lng: float) -> bool:
    return abs(lat - VILA[0]) <= MEIA_ALTURA and abs(lng - VILA[1]) <= MEIA_LARGURA


def metros(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1]) * 111_320  # ~ metros por grau no equador


def test_pelo_menos_dois_tercos_visiveis_ao_abrir_o_mapa():
    visiveis = [p["name"] for p in PLACES if visivel_no_zoom_14(*coordenadas(p))]

    assert len(visiveis) * 3 >= len(PLACES) * 2, f"{len(visiveis)} de {len(PLACES)}: {visiveis}"


def test_estabelecimentos_ficam_na_vila():
    for p in PLACES:
        if p["kind"] == "business":
            assert visivel_no_zoom_14(*coordenadas(p)), p["name"]


def test_praias_ficam_nas_bordas_e_espalhadas():
    praias = [coordenadas(p) for p in PLACES if p["kind"] == "beach"]

    assert len(praias) >= 3
    # longe da vila e longe umas das outras (mais de 1 km)
    assert all(metros(praia, VILA) > 1000 for praia in praias)
    assert all(metros(a, b) > 1000 for i, a in enumerate(praias) for b in praias[i + 1 :])


def test_ponto_de_carrocas_fica_no_trapiche():
    (ponto,) = [p for p in PLACES if p["name"] == "Ponto de Carroças"]

    assert ponto["category"] == "carroceiros"
    assert metros(coordenadas(ponto), TRAPICHE) < 200


def test_todos_dentro_do_recorte_do_mapa():
    for p in PLACES:
        lat, lng = coordenadas(p)
        assert RECORTE["sul"] < lat < RECORTE["norte"], p["name"]
        assert RECORTE["oeste"] < lng < RECORTE["leste"], p["name"]
