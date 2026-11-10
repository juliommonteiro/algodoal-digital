"""Painel do parceiro (#26): o dono edita o próprio estabelecimento."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.schemas.admin import Horarios, Servico, TextoCurto, _vazio_vira_nulo, validar_horarios


class NegocioDoParceiroUpdate(BaseModel):
    """PATCH /partner/places/{id}: só o que vier muda. Nome, categoria, posição no mapa e o selo
    de parceiro do projeto continuam com o admin."""

    model_config = ConfigDict(extra="forbid")

    description: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None
    ) = None
    # "Aparece no mapa e no diretório" (protótipo 09).
    is_published: bool | None = None
    whatsapp: TextoCurto | None = None
    phone: TextoCurto | None = None
    opening_hours: Horarios | None = None
    price_range: Literal["$", "$$", "$$$"] | None = None
    services: list[Servico] | None = Field(default=None, max_length=30)

    _vazios = field_validator("description", "whatsapp", "phone", "price_range", mode="before")(
        _vazio_vira_nulo
    )
    _horarios = field_validator("opening_hours")(validar_horarios)
