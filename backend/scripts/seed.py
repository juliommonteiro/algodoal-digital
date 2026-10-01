"""Popula o banco com dados FICTÍCIOS de demonstração.

    python -m scripts.seed            # insere o que faltar
    python -m scripts.seed --reset    # apaga o que tem source='ficticio' e insere de novo

É idempotente: cada registro é procurado pela sua chave natural (slug, e-mail, nome)
antes de ser inserido, então rodar duas vezes não duplica nada.

Nada aqui corresponde à realidade de Algodoal: nomes, telefones, e-mails e coordenadas
são inventados. Os dados reais entram depois da validação em campo, com source='campo'.
"""

from __future__ import annotations

import argparse
import sys
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import gerar_hash, verificar_senha
from app.db.session import SessionLocal
from app.models import Business, Carrier, Category, Place, PlacePhoto, User

FICTICIO = "ficticio"

# Hierarquia da seção 7 do PRD. Estrutura real do diretório, não é dado fictício.
CATEGORIAS: list[dict[str, Any]] = [
    {
        "slug": "turismo",
        "name": "Turismo",
        "icon": "compass",
        "children": [
            {"slug": "praias", "name": "Praias", "icon": "waves"},
            {"slug": "trilhas", "name": "Trilhas", "icon": "footprints"},
            {"slug": "pontos-turisticos", "name": "Pontos turísticos", "icon": "camera"},
            {"slug": "experiencias", "name": "Experiências", "icon": "sparkles"},
        ],
    },
    {
        "slug": "alimentacao",
        "name": "Alimentação",
        "icon": "utensils",
        "children": [
            {"slug": "restaurantes", "name": "Restaurantes", "icon": "utensils"},
            {"slug": "lanchonetes", "name": "Lanchonetes", "icon": "sandwich"},
            {"slug": "barracas", "name": "Barracas", "icon": "umbrella"},
        ],
    },
    {
        "slug": "hospedagem",
        "name": "Hospedagem",
        "icon": "bed",
        "children": [
            {"slug": "pousadas", "name": "Pousadas", "icon": "bed"},
            {"slug": "hospedagens", "name": "Hospedagens", "icon": "home"},
        ],
    },
    {
        "slug": "servicos",
        "name": "Serviços",
        "icon": "wrench",
        "children": [
            {"slug": "carroceiros", "name": "Carroceiros", "icon": "truck"},
            {"slug": "guias", "name": "Guias", "icon": "map"},
            {"slug": "outros", "name": "Outros", "icon": "dots"},
        ],
    },
    {
        "slug": "cultura",
        "name": "Cultura",
        "icon": "music",
        "children": [
            {"slug": "artesanato", "name": "Artesanato", "icon": "scissors"},
            {"slug": "cultura-local", "name": "Cultura local", "icon": "music"},
            {"slug": "eventos", "name": "Eventos", "icon": "calendar"},
        ],
    },
    {
        "slug": "preservacao",
        "name": "Preservação",
        "icon": "leaf",
        "children": [
            {"slug": "pontos-de-coleta", "name": "Pontos de coleta", "icon": "recycle"},
            {"slug": "missoes-ambientais", "name": "Missões ambientais", "icon": "leaf"},
        ],
    },
]

# Coordenadas numa geografia plausível da Ilha de Maiandeua, conferidas contra o arquivo de
# tiles do app (frontend/public/mapa/algodoal.pmtiles) para nada cair na água:
# - estabelecimentos, roda de carimbó e mirante na vila (-0.5922, -47.5861), que aparece inteira
#   no zoom 14 com que o mapa abre;
# - as praias nas bordas da ilha (norte, sul, leste);
# - trilhas e ponto de coleta entre a vila e as praias;
# - o ponto de carroças no começo do trapiche, onde chega o barco de Marudá.
# Abrindo o mapa (zoom 14, tela de 390x844), 12 dos 16 locais ficam visíveis. Os nomes
# continuam inventados: são lugares fictícios postos sobre o mapa real.
PLACES: list[dict[str, Any]] = [
    {
        "name": "Praia do Cajueiro Torto",
        "kind": "beach",
        "category": "praias",
        "latitude": "-0.579500",
        "longitude": "-47.579600",
        "description": "Faixa de areia larga, boa para banho na maré baixa. Local fictício.",
    },
    {
        "name": "Praia da Maré Virada",
        "kind": "beach",
        "category": "praias",
        "latitude": "-0.607600",
        "longitude": "-47.581950",
        "description": "Mar aberto e vento constante à tarde. Local fictício.",
    },
    {
        "name": "Praia do Sol Deitado",
        "kind": "beach",
        "category": "praias",
        "latitude": "-0.625000",
        "longitude": "-47.540600",
        "description": "Trecho tranquilo, sem estrutura. Local fictício.",
    },
    {
        "name": "Trilha do Vento Sul",
        "kind": "trail",
        "category": "trilhas",
        "latitude": "-0.585500",
        "longitude": "-47.580500",
        "description": "Cerca de 40 minutos entre o campo e o mangue. Local fictício.",
    },
    {
        "name": "Trilha das Dunas Claras",
        "kind": "trail",
        "category": "trilhas",
        "latitude": "-0.603800",
        "longitude": "-47.583000",
        "description": "Percurso curto sobre dunas fixas. Local fictício.",
    },
    {
        "name": "Mirante da Pedra Lisa",
        "kind": "tourist_point",
        "category": "pontos-turisticos",
        "latitude": "-0.587900",
        "longitude": "-47.586800",
        "description": "Ponto alto com vista para a foz. Local fictício.",
    },
    {
        "name": "Passeio de Canoa ao Entardecer",
        "kind": "experience",
        "category": "experiencias",
        "latitude": "-0.596600",
        "longitude": "-47.584200",
        "description": "Saída de canoa pelo furo, com guia local. Experiência fictícia.",
    },
    {
        "name": "Roda de Carimbó do Terreiro Velho",
        "kind": "culture",
        "category": "cultura-local",
        "latitude": "-0.591500",
        "longitude": "-47.585200",
        "description": "Roda aberta aos sábados na praça. Evento fictício.",
    },
    {
        "name": "Ponto de Coleta Boca da Mata",
        "kind": "collection_point",
        "category": "pontos-de-coleta",
        "latitude": "-0.595000",
        "longitude": "-47.581600",
        "description": "Recebe vidro, plástico e alumínio. Ponto fictício.",
    },
    {
        "name": "Ponto de Carroças",
        "kind": "tourist_point",
        "category": "carroceiros",
        "latitude": "-0.599000",
        "longitude": "-47.586600",
        "description": "Onde as carroças esperam quem chega pelo trapiche. Ponto fictício.",
    },
    {
        "name": "Pousada Maré Mansa",
        "kind": "business",
        "category": "pousadas",
        "latitude": "-0.589400",
        "longitude": "-47.587800",
        "description": "Dez quartos com rede na varanda. Estabelecimento fictício.",
    },
    {
        "name": "Pousada Rede de Areia",
        "kind": "business",
        "category": "pousadas",
        "latitude": "-0.593400",
        "longitude": "-47.583800",
        "description": "Hospedagem simples de frente para o campo. Estabelecimento fictício.",
    },
    {
        "name": "Restaurante Vento Sul",
        "kind": "business",
        "category": "restaurantes",
        "latitude": "-0.590600",
        "longitude": "-47.587000",
        "description": "Peixe frito e camarão no almoço. Estabelecimento fictício.",
    },
    {
        "name": "Lanchonete Caju Verde",
        "kind": "business",
        "category": "lanchonetes",
        "latitude": "-0.592600",
        "longitude": "-47.587600",
        "description": "Açaí, tapioca e suco de cupuaçu. Estabelecimento fictício.",
    },
    {
        "name": "Barraca do Peixe Dourado",
        "kind": "business",
        "category": "barracas",
        "latitude": "-0.594000",
        "longitude": "-47.588400",
        "description": "Barraca de praia com cadeiras e petiscos. Estabelecimento fictício.",
    },
    {
        "name": "Ateliê Linha da Maré",
        "kind": "business",
        "category": "artesanato",
        "latitude": "-0.589600",
        "longitude": "-47.584800",
        "description": "Peças de palha e crochê feitas na hora. Estabelecimento fictício.",
    },
]

# Telefones no padrão reservado para ficção: (91) 95555-XXXX.
BUSINESSES: list[dict[str, Any]] = [
    {
        "place": "Pousada Maré Mansa",
        "whatsapp": "(91) 95555-0101",
        "phone": "(91) 95555-0101",
        "price_range": "$$",
        "is_partner": True,
        "opening_hours": {
            "seg": [["07:00", "21:00"]],
            "ter": [["07:00", "21:00"]],
            "qua": [["07:00", "21:00"]],
            "qui": [["07:00", "21:00"]],
            "sex": [["07:00", "22:00"]],
            "sab": [["07:00", "22:00"]],
            "dom": [["07:00", "21:00"]],
        },
        "services": ["café da manhã", "wi-fi", "rede na varanda"],
        "owner_email": "celia.parceira@example.com",
    },
    {
        "place": "Pousada Rede de Areia",
        "whatsapp": "(91) 95555-0102",
        "phone": None,
        "price_range": "$",
        "is_partner": False,
        "opening_hours": {"seg": [["08:00", "20:00"]], "sab": [["08:00", "20:00"]]},
        "services": ["ventilador", "estacionamento de bicicleta"],
        "owner_email": None,
    },
    {
        "place": "Restaurante Vento Sul",
        "whatsapp": "(91) 95555-0103",
        "phone": "(91) 95555-0103",
        "price_range": "$$",
        "is_partner": True,
        "opening_hours": {
            "ter": [["11:00", "16:00"]],
            "qua": [["11:00", "16:00"]],
            "qui": [["11:00", "16:00"]],
            "sex": [["11:00", "22:00"]],
            "sab": [["11:00", "22:00"]],
            "dom": [["11:00", "17:00"]],
        },
        "services": ["peixe frito", "camarão", "opção vegetariana"],
        "owner_email": None,
    },
    {
        "place": "Lanchonete Caju Verde",
        "whatsapp": "(91) 95555-0104",
        "phone": None,
        "price_range": "$",
        "is_partner": False,
        "opening_hours": {"seg": [["15:00", "22:00"]], "dom": [["15:00", "22:00"]]},
        "services": ["açaí", "tapioca", "suco"],
        "owner_email": None,
    },
    {
        "place": "Barraca do Peixe Dourado",
        "whatsapp": "(91) 95555-0105",
        "phone": None,
        "price_range": "$",
        "is_partner": False,
        "opening_hours": {"sab": [["09:00", "18:00"]], "dom": [["09:00", "18:00"]]},
        "services": ["petiscos", "cadeira e guarda-sol"],
        "owner_email": None,
    },
    {
        "place": "Ateliê Linha da Maré",
        "whatsapp": "(91) 95555-0106",
        "phone": None,
        "price_range": "$$",
        "is_partner": True,
        "opening_hours": {"qui": [["09:00", "17:00"]], "sex": [["09:00", "17:00"]]},
        "services": ["palha", "crochê", "encomenda"],
        "owner_email": None,
    },
]

# Um usuário de cada perfil. Senha fica nula: autenticação é da S5.
USERS: list[dict[str, Any]] = [
    {
        "name": "Ana Viajante",
        "email": "ana.turista@example.com",
        "phone": "(91) 95555-0201",
        "role": "tourist",
    },
    {
        "name": "Bento Carroça",
        "email": "bento.carroceiro@example.com",
        "phone": "(91) 95555-0202",
        "role": "carrier",
    },
    {
        "name": "Célia Parceira",
        "email": "celia.parceira@example.com",
        "phone": "(91) 95555-0203",
        "role": "partner",
    },
    {
        "name": "Davi Gestor",
        "email": "davi.admin@example.com",
        "phone": "(91) 95555-0204",
        "role": "admin",
    },
]

# Contas para entrar no app em desenvolvimento (README, "Contas de teste"). Todas com a mesma
# senha. Os demais usuários fictícios seguem sem senha, portanto sem login.
SENHA_DE_TESTE = "algodoal-teste"
CONTAS_DE_TESTE: list[dict[str, Any]] = [
    {"name": "Admin de Teste", "email": "admin@example.com", "role": "admin"},
    {"name": "Turista de Teste", "email": "turista@example.com", "role": "tourist"},
    {"name": "Carroceiro de Teste", "email": "carroceiro@example.com", "role": "carrier"},
]


class SeedEmProducao(RuntimeError):
    """O seed cria dados fictícios e contas com senha conhecida: nunca em produção."""


def garantir_que_nao_e_producao() -> None:
    if get_settings().environment == "production":
        raise SeedEmProducao(
            "O seed não roda com ENVIRONMENT=production: ele cria locais e usuários fictícios e "
            f"contas de teste com a senha conhecida {SENHA_DE_TESTE!r} (inclusive um admin). "
            "Para dados reais, use a importação da planilha de campo."
        )


# Cada carroceiro tem seu próprio user. O primeiro reaproveita o user de perfil 'carrier'.
CARRIERS: list[dict[str, Any]] = [
    {
        "user": {
            "name": "Bento Carroça",
            "email": "bento.carroceiro@example.com",
            "phone": "(91) 95555-0202",
            "role": "carrier",
        },
        "display_name": "Carroça do Bento",
        "whatsapp": "(91) 95555-0202",
        "capacity": 4,
        "is_available": True,
        "is_approved": True,
    },
    {
        "user": {
            "name": "Rosa Condutora",
            "email": "rosa.carroceira@example.com",
            "phone": "(91) 95555-0205",
            "role": "carrier",
        },
        "display_name": "Carroça da Rosa",
        "whatsapp": "(91) 95555-0205",
        "capacity": 2,
        "is_available": False,
        "is_approved": True,
    },
    {
        "user": {
            "name": "Tião Boiadeiro",
            "email": "tiao.carroceiro@example.com",
            "phone": "(91) 95555-0206",
            "role": "carrier",
        },
        "display_name": "Carroça do Tião",
        "whatsapp": "(91) 95555-0206",
        "capacity": 6,
        "is_available": True,
        "is_approved": False,
    },
]

# Sem foto real: as chaves apontam para arquivos que não existem, só para exercitar a tabela.
PLACE_PHOTOS: list[dict[str, Any]] = [
    {"place": "Praia do Cajueiro Torto", "storage_key": "ficticio/cajueiro-torto-01.webp"},
    {"place": "Pousada Maré Mansa", "storage_key": "ficticio/mare-mansa-01.webp"},
    {"place": "Restaurante Vento Sul", "storage_key": "ficticio/vento-sul-01.webp"},
]

TABELAS_DO_RESUMO = (
    ("categories", Category),
    ("users", User),
    ("places", Place),
    ("place_photos", PlacePhoto),
    ("businesses", Business),
    ("carriers", Carrier),
)


def reset_ficticios(session: Session) -> None:
    """Apaga só o que foi marcado como fictício. Dado de campo e categorias não são tocados."""
    ids_ficticios = select(Place.id).where(Place.source == FICTICIO)
    session.query(PlacePhoto).filter(PlacePhoto.place_id.in_(ids_ficticios)).delete(
        synchronize_session=False
    )
    session.query(Business).filter(Business.source == FICTICIO).delete(synchronize_session=False)
    session.query(Place).filter(Place.source == FICTICIO).delete(synchronize_session=False)
    session.flush()


def _seed_categories(session: Session) -> dict[str, Category]:
    por_slug: dict[str, Category] = {}
    for ordem_raiz, raiz in enumerate(CATEGORIAS):
        pai = session.scalar(select(Category).where(Category.slug == raiz["slug"]))
        if pai is None:
            pai = Category(
                slug=raiz["slug"], name=raiz["name"], icon=raiz["icon"], sort_order=ordem_raiz
            )
            session.add(pai)
            session.flush()
        por_slug[pai.slug] = pai
        for ordem_filha, filha in enumerate(raiz["children"]):
            atual = session.scalar(select(Category).where(Category.slug == filha["slug"]))
            if atual is None:
                atual = Category(
                    slug=filha["slug"],
                    name=filha["name"],
                    icon=filha["icon"],
                    sort_order=ordem_filha,
                    parent_id=pai.id,
                )
                session.add(atual)
                session.flush()
            por_slug[atual.slug] = atual
    return por_slug


def _seed_users(session: Session) -> dict[str, User]:
    por_email: dict[str, User] = {}
    definicoes = list(USERS) + [c["user"] for c in CARRIERS]
    for definicao in definicoes:
        email = definicao["email"]
        if email in por_email:
            continue
        usuario = session.scalar(select(User).where(User.email == email))
        if usuario is None:
            usuario = User(
                name=definicao["name"],
                email=email,
                phone=definicao["phone"],
                role=definicao["role"],
                password_hash=None,  # S5
            )
            session.add(usuario)
            session.flush()
        por_email[email] = usuario
    return por_email


def _seed_contas_de_teste(session: Session) -> None:
    for definicao in CONTAS_DE_TESTE:
        usuario = session.scalar(select(User).where(User.email == definicao["email"]))
        if usuario is None:
            usuario = User(name=definicao["name"], email=definicao["email"])
            session.add(usuario)
        usuario.role = definicao["role"]
        usuario.is_active = True
        # Só regrava a senha se faltar ou não conferir: o Argon2 gera um hash diferente a cada
        # vez, e regravar sempre faria o seed mudar dados a cada execução.
        if (
            usuario.password_hash is None
            or not verificar_senha(SENHA_DE_TESTE, usuario.password_hash)[0]
        ):
            usuario.password_hash = gerar_hash(SENHA_DE_TESTE)
    session.flush()


def _seed_places(session: Session, categorias: dict[str, Category]) -> dict[str, Place]:
    por_nome: dict[str, Place] = {}
    for definicao in PLACES:
        local = session.scalar(select(Place).where(Place.name == definicao["name"]))
        if local is None:
            local = Place(
                name=definicao["name"],
                kind=definicao["kind"],
                category_id=categorias[definicao["category"]].id,
                latitude=Decimal(definicao["latitude"]),
                longitude=Decimal(definicao["longitude"]),
                description=definicao["description"],
                is_published=True,
                source=FICTICIO,
            )
            session.add(local)
            session.flush()
        elif local.source == FICTICIO:
            # Bancos semeados antes da correção têm as coordenadas antigas, espalhadas e com
            # local no mar; rodar o seed de novo as acerta. Dado de campo não é tocado.
            local.latitude = Decimal(definicao["latitude"])
            local.longitude = Decimal(definicao["longitude"])
        por_nome[local.name] = local
    return por_nome


def _seed_place_photos(session: Session, places: dict[str, Place]) -> None:
    # position conta a partir de 0 dentro de cada local, na ordem de PLACE_PHOTOS.
    proxima_posicao: dict[str, int] = {}
    for definicao in PLACE_PHOTOS:
        local = places[definicao["place"]]
        posicao = proxima_posicao.get(local.name, 0)
        proxima_posicao[local.name] = posicao + 1
        existente = session.scalar(
            select(PlacePhoto).where(PlacePhoto.storage_key == definicao["storage_key"])
        )
        if existente is None:
            session.add(
                PlacePhoto(
                    place_id=local.id, storage_key=definicao["storage_key"], position=posicao
                )
            )
        elif existente.position != posicao:
            # Bancos semeados antes da correção têm a numeração global antiga (0, 1, 2 entre
            # locais diferentes); rodar o seed de novo acerta.
            existente.position = posicao
    session.flush()


def _seed_businesses(session: Session, places: dict[str, Place], users: dict[str, User]) -> None:
    for definicao in BUSINESSES:
        local = places[definicao["place"]]
        existente = session.scalar(select(Business).where(Business.place_id == local.id))
        if existente is not None:
            continue
        dono = users.get(definicao["owner_email"]) if definicao["owner_email"] else None
        session.add(
            Business(
                place_id=local.id,
                owner_id=dono.id if dono else None,
                whatsapp=definicao["whatsapp"],
                phone=definicao["phone"],
                opening_hours=definicao["opening_hours"],
                price_range=definicao["price_range"],
                services=definicao["services"],
                is_partner=definicao["is_partner"],
                source=FICTICIO,
            )
        )
    session.flush()


def _seed_carriers(session: Session, users: dict[str, User]) -> None:
    for definicao in CARRIERS:
        usuario = users[definicao["user"]["email"]]
        existente = session.scalar(select(Carrier).where(Carrier.user_id == usuario.id))
        if existente is not None:
            continue
        session.add(
            Carrier(
                user_id=usuario.id,
                display_name=definicao["display_name"],
                whatsapp=definicao["whatsapp"],
                capacity=definicao["capacity"],
                is_available=definicao["is_available"],
                is_approved=definicao["is_approved"],
            )
        )
    session.flush()


def contagens(session: Session) -> dict[str, int]:
    return {
        nome: session.scalar(select(func.count()).select_from(model)) or 0
        for nome, model in TABELAS_DO_RESUMO
    }


def seed(session: Session, reset: bool = False) -> dict[str, int]:
    """Insere o que faltar e devolve a contagem por tabela. Chamar duas vezes não duplica.
    Recusa rodar em produção (SeedEmProducao) antes de qualquer escrita."""
    garantir_que_nao_e_producao()
    if reset:
        reset_ficticios(session)
    categorias = _seed_categories(session)
    usuarios = _seed_users(session)
    _seed_contas_de_teste(session)
    locais = _seed_places(session, categorias)
    _seed_place_photos(session, locais)
    _seed_businesses(session, locais, usuarios)
    _seed_carriers(session, usuarios)
    session.commit()
    return contagens(session)


def _imprime_resumo(resumo: dict[str, int], reset: bool) -> None:
    aviso = [
        "ATENÇÃO: DADOS FICTÍCIOS DE DEMONSTRAÇÃO",
        "Nomes, telefones, e-mails e coordenadas são",
        "inventados. Nada aqui corresponde a pessoas",
        "ou lugares reais de Algodoal.",
    ]
    largura = max(len(linha) for linha in aviso) + 8

    print()
    print("Seed concluído" + (" (com --reset)" if reset else ""))
    print("-" * largura)
    for nome, total in resumo.items():
        print(f"{nome:<20} {total:>5}")
    print("-" * largura)
    print("!" * largura)
    for linha in aviso:
        print("!!  " + linha.ljust(largura - 8) + "  !!")
    print("!" * largura)
    print()
    print(f"Contas de teste (senha {SENHA_DE_TESTE!r}):")
    for conta in CONTAS_DE_TESTE:
        print(f"  {conta['email']:<26} {conta['role']}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--reset",
        action="store_true",
        help="apaga as linhas com source='ficticio' antes de inserir",
    )
    args = parser.parse_args()

    try:
        garantir_que_nao_e_producao()
    except SeedEmProducao as erro:
        print(f"ERRO: {erro}", file=sys.stderr)
        sys.exit(1)

    with SessionLocal() as session:
        resumo = seed(session, reset=args.reset)
    _imprime_resumo(resumo, args.reset)


if __name__ == "__main__":
    main()
