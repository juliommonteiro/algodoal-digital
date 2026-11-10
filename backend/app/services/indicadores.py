"""Indicadores do piloto (#40): contagens para o painel admin, direto do banco.

Os de gamificação do PRD §18 (missões realizadas, pontos distribuídos, ações ambientais) ainda
não têm tabela: entram quando o passaporte entrar.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import Date, cast, distinct, func, select
from sqlalchemy.orm import Session

from app.models import Business, Carrier, Place, PlacePhoto, RefreshToken, RideRequest, User
from app.schemas.indicadores import (
    Indicadores,
    IndicadoresCarroceiros,
    IndicadoresLocais,
    IndicadoresPedidos,
    IndicadoresUsuarios,
    PedidoDeHoje,
)
from app.services import carroca

# "Hoje" é o dia na ilha, não em UTC: às 22h de Algodoal já é o dia seguinte em UTC.
FUSO_DA_ILHA = "America/Belem"
LIMITE_DE_PEDIDOS_DE_HOJE = 30


def _contar(db: Session, *condicoes, modelo=None) -> int:
    consulta = (
        select(func.count()).select_from(modelo) if modelo is not None else select(func.count())
    )
    return db.scalar(consulta.where(*condicoes)) or 0


def calcular(db: Session) -> Indicadores:
    carroca.expirar_vencidos(db)  # o status dos pedidos sai certo
    db.commit()
    agora = datetime.now(UTC)
    semana = agora - timedelta(days=7)

    por_perfil = dict(db.execute(select(User.role, func.count()).group_by(User.role)).all())
    usuarios = IndicadoresUsuarios(
        total=sum(por_perfil.values()),
        ativos_30_dias=db.scalar(
            select(func.count(distinct(RefreshToken.user_id))).where(
                RefreshToken.created_at >= agora - timedelta(days=30)
            )
        )
        or 0,
        turistas=por_perfil.get("tourist", 0),
        carroceiros=por_perfil.get("carrier", 0),
        parceiros=por_perfil.get("partner", 0),
        admins=por_perfil.get("admin", 0),
    )

    vivo = Place.deleted_at.is_(None)
    negocios_vivos = select(Business).join(Business.place).where(vivo).subquery()
    locais = IndicadoresLocais(
        publicados=_contar(db, vivo, Place.is_published.is_(True), modelo=Place),
        rascunhos=_contar(db, vivo, Place.is_published.is_(False), modelo=Place),
        removidos=_contar(db, Place.deleted_at.is_not(None), modelo=Place),
        estabelecimentos=_contar(db, modelo=negocios_vivos),
        estabelecimentos_com_dono=_contar(
            db, negocios_vivos.c.owner_id.is_not(None), modelo=negocios_vivos
        ),
        com_foto=db.scalar(
            select(func.count(distinct(PlacePhoto.place_id))).join(Place).where(vivo)
        )
        or 0,
    )

    carroceiros = IndicadoresCarroceiros(
        total=_contar(db, Carrier.is_approved.is_(True), modelo=Carrier),
        disponiveis=_contar(
            db, Carrier.is_approved.is_(True), Carrier.is_available.is_(True), modelo=Carrier
        ),
    )

    da_semana = RideRequest.created_at >= semana
    aceitos = _contar(db, da_semana, RideRequest.status == "accepted", modelo=RideRequest)
    vencidos = _contar(db, da_semana, RideRequest.status == "expired", modelo=RideRequest)
    segundos = db.scalar(
        select(
            func.avg(func.extract("epoch", RideRequest.responded_at - RideRequest.created_at))
        ).where(da_semana, RideRequest.status == "accepted", RideRequest.responded_at.is_not(None))
    )
    pedidos = IndicadoresPedidos(
        total=_contar(db, modelo=RideRequest),
        ultimos_7_dias=_contar(db, da_semana, modelo=RideRequest),
        aceitos_7_dias=aceitos,
        taxa_de_aceite_7_dias=round(aceitos / (aceitos + vencidos), 3)
        if aceitos + vencidos
        else None,
        minutos_ate_aceite_7_dias=round(float(segundos) / 60, 1) if segundos is not None else None,
    )

    dia_na_ilha = cast(func.timezone(FUSO_DA_ILHA, RideRequest.created_at), Date)
    hoje_na_ilha = cast(func.timezone(FUSO_DA_ILHA, func.now()), Date)
    de_hoje = db.scalars(
        select(RideRequest)
        .where(dia_na_ilha == hoje_na_ilha)
        .order_by(RideRequest.created_at.desc())
        .limit(LIMITE_DE_PEDIDOS_DE_HOJE)
    )

    return Indicadores(
        gerado_em=agora,
        usuarios=usuarios,
        locais=locais,
        carroceiros=carroceiros,
        pedidos=pedidos,
        pedidos_de_hoje=[PedidoDeHoje.model_validate(p, from_attributes=True) for p in de_hoje],
    )
