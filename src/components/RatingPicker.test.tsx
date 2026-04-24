/**
 * Component tests for RatingPicker.
 *
 * Focus: verify the UI distinguishes EXPLICIT vs INHERITED (isAverage)
 * ratings at each level of the hierarchy (Série / Temporada / Episódio).
 *
 * The component itself is level-agnostic — the calling screen passes a `label`
 * like "Avaliar série", "Avaliar temporada 1", etc. We exercise all three
 * label variants to mirror what SeasonsAccordion renders in production.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RatingPicker } from "./RatingPicker";

const noop = () => {};

describe("RatingPicker — explicit vs inherited (isAverage)", () => {
  describe("Série", () => {
    it("mostra valor explícito SEM marcador 'média' e com estilo primary", () => {
      render(
        <RatingPicker
          value={8}
          isAverage={false}
          label="Avaliar série"
          onChange={noop}
        />
      );
      const trigger = screen.getByRole("button", { name: "Avaliar série" });
      expect(trigger).toHaveTextContent("8");
      expect(trigger).not.toHaveTextContent("média");
      expect(trigger.className).toContain("bg-primary/10");
      expect(trigger.className).not.toContain("italic");
    });

    it("mostra valor herdado (isAverage) COM marcador 'média' e estilo muted/itálico", () => {
      render(
        <RatingPicker
          value={7.5}
          isAverage
          label="Avaliar série"
          onChange={noop}
        />
      );
      const trigger = screen.getByRole("button", { name: "Avaliar série" });
      expect(trigger).toHaveTextContent("7.5");
      expect(trigger).toHaveTextContent("média");
      expect(trigger.className).toContain("bg-muted");
      expect(trigger.className).toContain("italic");
    });
  });

  describe("Temporada", () => {
    it("valor explícito da temporada não exibe 'média'", () => {
      render(
        <RatingPicker
          value={9}
          isAverage={false}
          label="Avaliar temporada 1"
          onChange={noop}
        />
      );
      const trigger = screen.getByRole("button", { name: "Avaliar temporada 1" });
      expect(trigger).toHaveTextContent("9");
      expect(trigger).not.toHaveTextContent("média");
    });

    it("valor herdado da série exibido na temporada mostra 'média'", () => {
      render(
        <RatingPicker
          value={6}
          isAverage
          label="Avaliar temporada 1"
          onChange={noop}
        />
      );
      const trigger = screen.getByRole("button", { name: "Avaliar temporada 1" });
      expect(trigger).toHaveTextContent("6");
      expect(trigger).toHaveTextContent("média");
    });
  });

  describe("Episódio", () => {
    it("valor explícito do episódio não exibe 'média' e estiliza com primary", () => {
      render(
        <RatingPicker
          value={10}
          isAverage={false}
          label="Avaliar episódio 3"
          onChange={noop}
        />
      );
      const trigger = screen.getByRole("button", { name: "Avaliar episódio 3" });
      expect(trigger).toHaveTextContent("10");
      expect(trigger).not.toHaveTextContent("média");
      expect(trigger.className).toContain("bg-primary/10");
    });

    it("valor herdado (de temporada ou série) no episódio mostra 'média'", () => {
      render(
        <RatingPicker
          value={7}
          isAverage
          label="Avaliar episódio 3"
          onChange={noop}
        />
      );
      const trigger = screen.getByRole("button", { name: "Avaliar episódio 3" });
      expect(trigger).toHaveTextContent("7");
      expect(trigger).toHaveTextContent("média");
      expect(trigger.className).toContain("bg-muted");
    });
  });

  describe("Estado vazio", () => {
    it("sem valor mostra '—' e nenhum marcador 'média', mesmo se isAverage=true", () => {
      render(
        <RatingPicker
          value={null}
          isAverage
          label="Avaliar série"
          onChange={noop}
        />
      );
      const trigger = screen.getByRole("button", { name: "Avaliar série" });
      expect(trigger).toHaveTextContent("—");
      expect(trigger).not.toHaveTextContent("média");
      // Sem nota, não aplica estilo primary nem muted
      expect(trigger.className).not.toContain("bg-primary/10");
      expect(trigger.className).not.toContain("bg-muted");
    });
  });

  describe("Interações no popover (apenas explícito é removível)", () => {
    it("popover de valor EXPLÍCITO mostra botão 'Remover nota'", () => {
      render(
        <RatingPicker
          value={8}
          isAverage={false}
          label="Avaliar temporada 2"
          onChange={noop}
          open
        />
      );
      expect(
        screen.getByRole("button", { name: /remover nota/i })
      ).toBeInTheDocument();
    });

    it("popover de valor HERDADO (isAverage) NÃO mostra 'Remover nota'", () => {
      render(
        <RatingPicker
          value={8}
          isAverage
          label="Avaliar temporada 2"
          onChange={noop}
          open
        />
      );
      expect(
        screen.queryByRole("button", { name: /remover nota/i })
      ).not.toBeInTheDocument();
    });

    it("clicar em uma estrela emite onChange com o valor selecionado (sobrescrevendo herança)", () => {
      const onChange = vi.fn();
      render(
        <RatingPicker
          value={5}
          isAverage
          label="Avaliar episódio 1"
          onChange={onChange}
          open
        />
      );
      // Estrelas no popover têm aria-label "N de 10"
      fireEvent.click(screen.getByRole("button", { name: "9 de 10" }));
      expect(onChange).toHaveBeenCalledWith(9);
    });
  });
});
