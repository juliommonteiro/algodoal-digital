"""Tipos de contato compartilhados pelos schemas (cadastro de carroceiro, pedido de carroça)."""

import re
from typing import Annotated

from pydantic import AfterValidator, StringConstraints
from pydantic_core import PydanticCustomError


def _validar_whatsapp(valor: str) -> str:
    # Com DDD (10 ou 11 dígitos) ou já com o 55 do Brasil: é o que o link wa.me aceita.
    digitos = re.sub(r"\D", "", valor)
    if not (len(digitos) in (10, 11) or (len(digitos) in (12, 13) and digitos[:2] == "55")):
        raise PydanticCustomError(
            "whatsapp_invalido", "Informe o WhatsApp com DDD, por exemplo (91) 98888-7777."
        )
    return valor


WhatsApp = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=30), AfterValidator(_validar_whatsapp)
]
