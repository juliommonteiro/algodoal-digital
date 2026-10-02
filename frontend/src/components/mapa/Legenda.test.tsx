import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Legenda } from './Legenda'

describe('legenda do mapa', () => {
  it('começa fechada: só o botão', () => {
    render(<Legenda />)

    const botao = screen.getByRole('button', { name: 'Legenda' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('aberta mostra os quatro grupos e os sete tipos', () => {
    render(<Legenda />)

    fireEvent.click(screen.getByRole('button', { name: 'Legenda' }))

    expect(screen.getByRole('button', { name: 'Fechar legenda' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const grupos = screen.getAllByRole('list')
    expect(grupos).toHaveLength(4)
    const porGrupo = Object.fromEntries(
      grupos.map((lista) => [
        document.getElementById(lista.getAttribute('aria-labelledby')!)!.textContent,
        within(lista)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ]),
    )
    // O quadradinho de cada tipo usa a mesma classe de grupo do pino no mapa.
    const classesDosPinos = grupos.map((lista) =>
      [...lista.querySelectorAll('.legenda__pino')].map((pino) =>
        [...pino.classList].find((c) => c.startsWith('pino--')),
      ),
    )
    expect(classesDosPinos).toEqual([
      ['pino--explorar', 'pino--explorar', 'pino--explorar'],
      ['pino--economia', 'pino--economia'],
      ['pino--ambiental'],
      ['pino--cultura'],
    ])
    expect(porGrupo).toEqual({
      Explorar: ['Praia', 'Trilha', 'Ponto turístico'],
      'Economia local': ['Estabelecimento', 'Experiência'],
      Ambiental: ['Ponto de coleta'],
      Cultura: ['Cultura'],
    })
  })

  it('Esc fecha e devolve o foco ao botão', () => {
    render(<Legenda />)
    fireEvent.click(screen.getByRole('button', { name: 'Legenda' }))

    fireEvent.keyDown(screen.getAllByRole('listitem')[0], { key: 'Escape' })

    const botao = screen.getByRole('button', { name: 'Legenda' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(botao).toHaveFocus()
  })
})
