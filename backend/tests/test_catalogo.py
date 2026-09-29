"""Endpoints públicos do catálogo: GET /categories, /places e /places/{id}.

O banco pode ter o seed; por isso cada teste monta o próprio cenário com slugs e nomes
únicos e só confere o que criou. Tudo some no ROLLBACK da fixture `db`.
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import event, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Business, Category, Place, PlacePhoto
from tests.conftest import precisa_de_banco

pytestmark = [pytest.mark.db, precisa_de_banco]

# Campos das interfaces do PWA (frontend/src/lib/tipos.ts). A resposta tem que ter
# exatamente estes — nem a mais (ex.: `source`), nem a menos.
CAMPOS_CATEGORIA = {"id", "slug", "name", "icon", "parent_id", "sort_order"}
CAMPOS_LOCAL = {
    "id", "name", "description", "kind", "category_id", "latitude", "longitude",
    "is_published", "updated_at", "business", "photos",
}  # fmt: skip
CAMPOS_NEGOCIO = {"whatsapp", "phone", "opening_hours", "price_range", "services", "is_partner"}
CAMPOS_FOTO = {"id", "storage_key", "position"}


# ---------------------------------------------------------------------------- cenário


def _sufixo() -> str:
    return uuid.uuid4().hex[:10]


def categoria(db: Session, mae: Category | None = None, sort_order: int = 0) -> Category:
    s = _sufixo()
    c = Category(
        slug=f"teste-{s}",
        name=f"Categoria {s}",
        parent_id=mae.id if mae else None,
        sort_order=sort_order,
    )
    db.add(c)
    db.flush()
    return c


def local(
    db: Session,
    cat: Category,
    *,
    kind: str = "beach",
    publicado: bool = True,
    removido: bool = False,
) -> Place:
    p = Place(
        name=f"Local {_sufixo()}",
        kind=kind,
        category_id=cat.id,
        latitude=Decimal("-0.585200"),
        longitude=Decimal("-47.561400"),
        description="Local fictício de teste.",
        is_published=publicado,
        deleted_at=datetime.now(UTC) if removido else None,
    )
    db.add(p)
    db.flush()
    return p


def reler_do_banco(db: Session) -> None:
    """Grava o pendente e esquece os objetos em memória: a API relê tudo do banco (senão a
    ordem das fotos, por exemplo, viria da ordem de inserção no identity map)."""
    db.flush()
    db.expire_all()


def nomes(resposta) -> list[str]:
    return [item["name"] for item in resposta.json()]


# ---------------------------------------------------------------------------- categorias


def test_categories_devolve_lista_plana_com_parent_id(db, api):
    mae = categoria(db, sort_order=0)
    filha_a = categoria(db, mae, sort_order=1)
    filha_b = categoria(db, mae, sort_order=2)
    reler_do_banco(db)

    resposta = api.get("/api/v1/categories")

    assert resposta.status_code == 200
    todas = resposta.json()
    por_slug = {c["slug"]: c for c in todas}
    assert por_slug[mae.slug]["parent_id"] is None
    assert por_slug[filha_a.slug]["parent_id"] == str(mae.id)
    assert por_slug[filha_b.slug]["parent_id"] == str(mae.id)
    assert all(set(c) == CAMPOS_CATEGORIA for c in todas)
    # Plana (sem aninhamento) e ordenada por sort_order, depois name
    assert todas == sorted(todas, key=lambda c: (c["sort_order"], c["name"]))


# ---------------------------------------------------------------------------- lista


def test_places_sem_filtro_traz_so_publicados(db, api):
    cat = categoria(db)
    publicado = local(db, cat)
    rascunho = local(db, cat, publicado=False)
    reler_do_banco(db)

    resposta = api.get("/api/v1/places")

    assert resposta.status_code == 200
    assert publicado.name in nomes(resposta)
    assert rascunho.name not in nomes(resposta)
    assert all(item["is_published"] is True for item in resposta.json())
    assert nomes(resposta) == sorted(nomes(resposta))


def test_filtro_pela_mae_traz_os_locais_das_filhas_e_netas(db, api):
    """O teste central: os locais apontam para a categoria mais específica, e o filtro da
    interface é a mãe. Um filtro literal por category_id devolveria lista vazia."""
    mae = categoria(db)
    filha_a = categoria(db, mae)
    filha_b = categoria(db, mae)
    neta = categoria(db, filha_a)
    outra_arvore = categoria(db)

    na_filha_a = local(db, filha_a)
    na_filha_b = local(db, filha_b, kind="trail")
    na_neta = local(db, neta, kind="business")
    fora = local(db, outra_arvore)
    reler_do_banco(db)

    resposta = api.get("/api/v1/places", params={"category": mae.slug})

    assert resposta.status_code == 200
    assert sorted(nomes(resposta)) == sorted([na_filha_a.name, na_filha_b.name, na_neta.name])
    assert fora.name not in nomes(resposta)
    # Nenhum local aponta direto para a mãe: é a recursão que traz os três.
    assert all(item["category_id"] != str(mae.id) for item in resposta.json())


def test_filtro_por_categoria_folha_traz_so_os_dela(db, api):
    mae = categoria(db)
    folha = categoria(db, mae)
    irma = categoria(db, mae)
    da_folha = local(db, folha)
    local(db, irma)
    reler_do_banco(db)

    resposta = api.get("/api/v1/places", params={"category": folha.slug})

    assert resposta.status_code == 200
    assert nomes(resposta) == [da_folha.name]


def test_slug_inexistente_devolve_200_e_lista_vazia(api):
    resposta = api.get("/api/v1/places", params={"category": f"nao-existe-{_sufixo()}"})

    assert resposta.status_code == 200
    assert resposta.json() == []


def test_filtro_por_kind_e_combinacao_com_categoria(db, api):
    mae = categoria(db)
    filha = categoria(db, mae)
    praia = local(db, filha, kind="beach")
    trilha = local(db, filha, kind="trail")
    reler_do_banco(db)

    so_praias = api.get("/api/v1/places", params={"kind": "beach"})
    combinado = api.get("/api/v1/places", params={"category": mae.slug, "kind": "trail"})

    assert so_praias.status_code == 200
    assert praia.name in nomes(so_praias)
    assert trilha.name not in nomes(so_praias)
    assert all(item["kind"] == "beach" for item in so_praias.json())
    assert nomes(combinado) == [trilha.name]


@pytest.mark.parametrize("valor", ["praia", "BEACH", ""])
def test_kind_invalido_devolve_422(api, valor):
    resposta = api.get("/api/v1/places", params={"kind": valor})
    assert resposta.status_code == 422


def test_nao_publicado_nao_aparece_na_lista_nem_no_detalhe(db, api):
    cat = categoria(db)
    rascunho = local(db, cat, publicado=False)
    reler_do_banco(db)

    assert rascunho.name not in nomes(api.get("/api/v1/places", params={"category": cat.slug}))
    assert api.get(f"/api/v1/places/{rascunho.id}").status_code == 404


def test_removido_nao_aparece_na_lista_nem_no_detalhe(db, api):
    cat = categoria(db)
    removido = local(db, cat, removido=True)
    reler_do_banco(db)

    assert removido.name not in nomes(api.get("/api/v1/places", params={"category": cat.slug}))
    assert api.get(f"/api/v1/places/{removido.id}").status_code == 404


# ---------------------------------------------------------------------------- detalhe


def test_detalhe_traz_negocio_e_fotos_ordenadas_por_position(db, api):
    cat = categoria(db)
    restaurante = local(db, cat, kind="business")
    db.add(
        Business(
            place_id=restaurante.id,
            whatsapp="(91) 95555-0103",
            phone=None,
            opening_hours={"ter": [["11:00", "16:00"]]},
            price_range="$$",
            services=["peixe frito", "camarão"],
            is_partner=True,
            source="ficticio",
        )
    )
    # Inseridas fora de ordem de propósito
    for posicao in (2, 0, 1):
        db.add(
            PlacePhoto(
                place_id=restaurante.id, storage_key=f"teste/{posicao}.webp", position=posicao
            )
        )
    reler_do_banco(db)

    resposta = api.get(f"/api/v1/places/{restaurante.id}")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert set(corpo) == CAMPOS_LOCAL
    assert "source" not in corpo
    assert set(corpo["business"]) == CAMPOS_NEGOCIO
    assert "source" not in corpo["business"]
    assert corpo["business"] == {
        "whatsapp": "(91) 95555-0103",
        "phone": None,
        "opening_hours": {"ter": [["11:00", "16:00"]]},
        "price_range": "$$",
        "services": ["peixe frito", "camarão"],
        "is_partner": True,
    }
    assert [f["position"] for f in corpo["photos"]] == [0, 1, 2]
    assert [f["storage_key"] for f in corpo["photos"]] == [
        "teste/0.webp",
        "teste/1.webp",
        "teste/2.webp",
    ]
    assert all(set(f) == CAMPOS_FOTO for f in corpo["photos"])


def test_local_sem_negocio_tem_business_null_e_photos_vazia(db, api):
    praia = local(db, categoria(db))
    reler_do_banco(db)

    corpo = api.get(f"/api/v1/places/{praia.id}").json()

    assert corpo["business"] is None
    assert corpo["photos"] == []


def test_services_nunca_e_nulo_depois_da_migracao(db, api):
    """businesses.services é NOT NULL DEFAULT '[]': uma forma só de dizer "sem serviços"."""
    coluna = db.execute(
        text(
            "SELECT is_nullable, column_default FROM information_schema.columns "
            "WHERE table_name = 'businesses' AND column_name = 'services'"
        )
    ).one()
    assert coluna.is_nullable == "NO"
    assert coluna.column_default == "'[]'::jsonb"
    assert db.scalar(text("SELECT count(*) FROM businesses WHERE services IS NULL")) == 0

    # Sem informar, vem lista vazia — pelo ORM e por SQL direto (DEFAULT do banco)
    loja = local(db, categoria(db), kind="business")
    db.add(Business(place_id=loja.id, source="ficticio"))
    reler_do_banco(db)
    assert api.get(f"/api/v1/places/{loja.id}").json()["business"]["services"] == []

    outra = local(db, categoria(db), kind="business")
    db.execute(
        text("INSERT INTO businesses (id, place_id) VALUES (gen_random_uuid(), :p)"),
        {"p": outra.id},
    )
    assert api.get(f"/api/v1/places/{outra.id}").json()["business"]["services"] == []

    # None no INSERT pelo ORM conta como "não informado": vale o default, lista vazia
    terceira = local(db, categoria(db), kind="business")
    negocio = Business(place_id=terceira.id, services=None, source="ficticio")
    db.add(negocio)
    db.flush()
    assert db.scalar(text("SELECT services FROM businesses WHERE id = :i"), {"i": negocio.id}) == []

    # None no UPDATE é recusado. Sem JSONB(none_as_null=True), o SQLAlchemy gravaria o JSON
    # 'null' — que passa pelo NOT NULL — e a API quebraria ao montar a lista
    with pytest.raises(IntegrityError, match="not-null|null value"), db.begin_nested():
        negocio.services = None
        db.flush()

    # Por SQL direto, o CHECK recusa JSON null e qualquer coisa que não seja lista
    for valor in ("null", '{"a": 1}', '"texto"'):
        with pytest.raises(IntegrityError, match="ck_businesses_services_lista"), db.begin_nested():
            db.execute(
                text(
                    "INSERT INTO businesses (id, place_id, services) "
                    "VALUES (gen_random_uuid(), :p, CAST(:v AS jsonb))"
                ),
                {"p": terceira.id, "v": valor},
            )


def test_detalhe_inexistente_404_e_id_mal_formado_422(api):
    assert api.get(f"/api/v1/places/{uuid.uuid4()}").status_code == 404
    assert api.get("/api/v1/places/nao-e-um-uuid").status_code == 422


# ---------------------------------------------------------------------------- formato


def test_latitude_e_longitude_saem_como_numero(db, api):
    praia = local(db, categoria(db))
    reler_do_banco(db)

    resposta = api.get(f"/api/v1/places/{praia.id}")

    corpo = resposta.json()
    assert type(corpo["latitude"]) is float
    assert type(corpo["longitude"]) is float
    assert corpo["latitude"] == -0.5852
    assert corpo["longitude"] == -47.5614
    # No texto cru também: número, não string entre aspas
    assert '"latitude":-0.5852' in resposta.text


def test_updated_at_em_iso_8601_com_fuso(db, api):
    praia = local(db, categoria(db))
    reler_do_banco(db)

    corpo = api.get(f"/api/v1/places/{praia.id}").json()

    assert datetime.fromisoformat(corpo["updated_at"]).tzinfo is not None


# ---------------------------------------------------------------------------- N+1


def _contar_selects(db: Session, chamada) -> int:
    """Conta os SELECTs emitidos na conexão da sessão durante `chamada()`."""
    contagem = 0

    def contar(_conn, _cursor, sql, *_args):
        nonlocal contagem
        if sql.lstrip().upper().startswith(("SELECT", "WITH")):
            contagem += 1

    conexao = db.connection()
    event.listen(conexao, "before_cursor_execute", contar)
    try:
        chamada()
    finally:
        event.remove(conexao, "before_cursor_execute", contar)
    return contagem


def _arvore_com_locais(db: Session, quantidade: int) -> Category:
    """Mãe + filha, `quantidade` locais na filha, cada um com negócio e duas fotos."""
    mae = categoria(db)
    filha = categoria(db, mae)
    for _ in range(quantidade):
        p = local(db, filha, kind="business")
        db.add(Business(place_id=p.id, services=["x"], source="ficticio"))
        db.add_all([PlacePhoto(place_id=p.id, storage_key=f"t/{i}", position=i) for i in (1, 0)])
    reler_do_banco(db)
    return mae


def test_listar_locais_nao_dispara_uma_consulta_por_item(db, api):
    # Só strings daqui em diante: ler `mae.slug` de um objeto expirado dentro da janela de
    # contagem dispararia um SELECT do próprio teste.
    pequena = _arvore_com_locais(db, 1).slug
    grande = _arvore_com_locais(db, 12).slug
    db.expire_all()

    respostas = {}

    def listar(slug):
        respostas[slug] = api.get("/api/v1/places", params={"category": slug})

    consultas_1 = _contar_selects(db, lambda: listar(pequena))
    db.expire_all()
    consultas_12 = _contar_selects(db, lambda: listar(grande))

    assert len(respostas[pequena].json()) == 1
    assert len(respostas[grande].json()) == 12
    assert all(len(item["photos"]) == 2 for item in respostas[grande].json())
    # locais (com a CTE embutida) + negócios + fotos, qualquer que seja N
    assert consultas_1 == consultas_12 == 3
