"""Schemas do painel administrativo. Os de escrita ficam separados dos de leitura: entrada é
validada aqui (inclusive a área do mapa); a saída reaproveita o contrato público."""

import re
import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from pydantic_core import PydanticCustomError

from app.schemas.place import PlaceKind, PlaceRead

# Área coberta pelo arquivo de tiles (frontend/public/mapa/algodoal.pmtiles, scripts/gerar-mapa.sh).
# Local fora dela não aparece no mapa — foi esse tipo de erro que pôs um ateliê no mar.
OESTE, SUL, LESTE, NORTE = -47.68, -0.66, -47.51, -0.56

DIAS = ("seg", "ter", "qua", "qui", "sex", "sab", "dom")
_HORA = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

StatusAdmin = Literal["publicado", "rascunho", "removido"]

TextoCurto = Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)]
Nome = Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)]
Servico = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


def _br(numero: float) -> str:
    return f"{numero:.2f}".replace(".", ",")


def _validar_latitude(valor: float) -> float:
    if not SUL <= valor <= NORTE:
        raise PydanticCustomError(
            "fora_do_mapa",
            "Fora da área do mapa: a latitude precisa ficar entre {sul} e {norte}. Com esta "
            "coordenada o local não apareceria no mapa.",
            {"sul": _br(SUL), "norte": _br(NORTE)},
        )
    return valor


def _validar_longitude(valor: float) -> float:
    if not OESTE <= valor <= LESTE:
        raise PydanticCustomError(
            "fora_do_mapa",
            "Fora da área do mapa: a longitude precisa ficar entre {oeste} e {leste}. Com esta "
            "coordenada o local não apareceria no mapa.",
            {"oeste": _br(OESTE), "leste": _br(LESTE)},
        )
    return valor


def _validar_nome(valor: str | None) -> str | None:
    if valor is not None and not valor:
        raise PydanticCustomError("obrigatorio", "Informe o nome do local.")
    return valor


def _vazio_vira_nulo(valor: Any) -> Any:
    return None if isinstance(valor, str) and not valor.strip() else valor


class BusinessWrite(BaseModel):
    """Dados comerciais de um local, como o painel envia."""

    model_config = ConfigDict(extra="forbid")

    whatsapp: TextoCurto | None = None
    phone: TextoCurto | None = None
    # {"seg": [["09:00", "22:00"]], ...}; dia ausente = fechado.
    opening_hours: dict[str, list[tuple[str, str]]] | None = None
    price_range: Literal["$", "$$", "$$$"] | None = None
    services: list[Servico] = Field(default_factory=list)
    is_partner: bool = False

    _vazios = field_validator("whatsapp", "phone", "price_range", mode="before")(_vazio_vira_nulo)

    @field_validator("opening_hours")
    @classmethod
    def _horarios(cls, valor: dict[str, list[tuple[str, str]]] | None) -> Any:
        if not valor:
            return None
        for dia, faixas in valor.items():
            if dia not in DIAS:
                raise PydanticCustomError(
                    "dia_invalido",
                    "O dia '{dia}' não existe (use seg, ter, qua, qui, sex, sab, dom).",
                    {"dia": dia},
                )
            for abre, fecha in faixas:
                if not _HORA.match(abre) or not _HORA.match(fecha):
                    raise PydanticCustomError(
                        "hora_invalida", "O horário deve estar no formato HH:MM."
                    )
                if abre >= fecha:
                    raise PydanticCustomError(
                        "faixa_invalida",
                        "Em {dia}, o horário de abrir precisa vir antes do de fechar.",
                        {"dia": dia},
                    )
        return valor


class PlaceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Nome
    description: str | None = None
    kind: PlaceKind
    category_id: uuid.UUID
    latitude: float
    longitude: float
    is_published: bool = True
    business: BusinessWrite | None = None

    _descricao = field_validator("description", mode="before")(_vazio_vira_nulo)
    _nome = field_validator("name")(_validar_nome)

    @field_validator("latitude")
    @classmethod
    def _lat(cls, valor: float) -> float:
        return _validar_latitude(valor)

    @field_validator("longitude")
    @classmethod
    def _lng(cls, valor: float) -> float:
        return _validar_longitude(valor)


# Campos que não podem receber null num PATCH (são NOT NULL no banco).
_OBRIGATORIOS = ("name", "kind", "category_id", "latitude", "longitude", "is_published")


class PlaceUpdate(BaseModel):
    """PATCH: só muda o que vier. `business: null` remove os dados comerciais; um objeto os
    substitui por inteiro."""

    model_config = ConfigDict(extra="forbid")

    name: Nome | None = None
    description: str | None = None
    kind: PlaceKind | None = None
    category_id: uuid.UUID | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_published: bool | None = None
    business: BusinessWrite | None = None

    _descricao = field_validator("description", mode="before")(_vazio_vira_nulo)
    _nome = field_validator("name")(_validar_nome)

    @field_validator(*_OBRIGATORIOS, mode="before")
    @classmethod
    def _nao_nulo(cls, valor: Any) -> Any:
        if valor is None:
            raise PydanticCustomError("obrigatorio", "Este campo não pode ficar vazio.")
        return valor

    @field_validator("latitude")
    @classmethod
    def _lat(cls, valor: float | None) -> float | None:
        return None if valor is None else _validar_latitude(valor)

    @field_validator("longitude")
    @classmethod
    def _lng(cls, valor: float | None) -> float | None:
        return None if valor is None else _validar_longitude(valor)


class PlaceAdminRead(PlaceRead):
    """O local como o painel vê: com o que o público não vê (remoção, origem do dado)."""

    deleted_at: datetime | None
    source: Literal["ficticio", "campo", "osm"]
    created_at: datetime
