import { describe, expect, it } from "vitest";
import { cleanReference, isAllowedShopUrl, pageContradicts, parseProductPage } from "./productPage.js";

const DOMAINS = ["karhabtk.tn", "bestoil.tn", "vidange.tn"];

describe("isAllowedShopUrl", () => {
  it("accepts shop pages and their subdomains", () => {
    expect(isAllowedShopUrl("https://www.karhabtk.tn/filtre/44001-filtre.html", DOMAINS)).toBe(true);
    expect(isAllowedShopUrl("http://vidange.tn/x.html", DOMAINS)).toBe(true);
    expect(isAllowedShopUrl("https://karhabtk.tn./x", DOMAINS)).toBe(true); // trailing dot
  });
  it("refuses other hosts, look-alikes, ports, credentials and schemes", () => {
    expect(isAllowedShopUrl("https://evil.com/karhabtk.tn", DOMAINS)).toBe(false);
    expect(isAllowedShopUrl("https://karhabtk.tn.evil.com/x", DOMAINS)).toBe(false);
    expect(isAllowedShopUrl("https://notkarhabtk.tn/x", DOMAINS)).toBe(false);
    expect(isAllowedShopUrl("https://karhabtk.tn:8080/x", DOMAINS)).toBe(false);
    expect(isAllowedShopUrl("https://user:pw@karhabtk.tn/x", DOMAINS)).toBe(false);
    expect(isAllowedShopUrl("file:///etc/passwd", DOMAINS)).toBe(false);
    expect(isAllowedShopUrl("http://127.0.0.1/x", DOMAINS)).toBe(false);
    expect(isAllowedShopUrl("http://[::1]/x", DOMAINS)).toBe(false);
    expect(isAllowedShopUrl("not a url", DOMAINS)).toBe(false);
  });
});

describe("cleanReference", () => {
  const url = "https://www.bestoil.tn/filtres/81980-z438-filtre-a-huile.html";
  it("keeps manufacturer part numbers", () => {
    expect(cleanReference("L008", url)).toBe("L008");
    expect(cleanReference(" C 2295/3 ", url)).toBe("C 2295/3");
    expect(cleanReference("5PK1153.", url)).toBe("5PK1153");
    expect(cleanReference("0 986 494 527", url)).toBe("0 986 494 527");
    expect(cleanReference("55223416", url)).toBe("55223416"); // 8-digit OE number
  });
  it("drops shop ids, barcodes and junk", () => {
    expect(cleanReference("81980", url)).toBeNull(); // id in the URL path
    expect(cleanReference("44001", "https://karhabtk.tn/index.php?id_product=44001")).toBeNull(); // id in the query
    expect(cleanReference("3165143284421", url)).toBeNull(); // EAN-13
    expect(cleanReference("ABARTH", url)).toBeNull(); // no digit
    expect(cleanReference("ab", url)).toBeNull();
    expect(cleanReference("<script>1</script>", url)).toBeNull();
    expect(cleanReference(null, url)).toBeNull();
  });
  it("keeps a number from the URL when the title also has it", () => {
    expect(cleanReference("55223416", "https://x.tn/55223416-filtre.html", "Filtre Fiat 55223416")).toBe("55223416");
  });
});

describe("parseProductPage", () => {
  it("reads a PrestaShop page (og:image + itemprop sku written in the title)", () => {
    const html = `<html><head><title>Filtre à huile</title>
      <meta property="og:image" content="https://www.karhabtk.tn/9569-large_default/filtre-a-huile.jpg">
      </head><body><img src="/img/logo.png">
      <span itemprop="sku">L008</span></body></html>`;
    const info = parseProductPage(html, "https://www.karhabtk.tn/-filtre-a-huile/44001-filtre-a-huile.html", "Filtre à huile MISFAT L008");
    expect(info.imageUrl).toBe("https://www.karhabtk.tn/9569-large_default/filtre-a-huile.jpg");
    expect(info.reference).toBe("L008");
    expect(info.pageName).toBe("Filtre à huile");
  });

  it("prefers mpn and ignores a shop id in sku", () => {
    const html = `<meta content="https://www.bestoil.tn/2522-large_default/z438.jpg" property="og:image">
      <meta itemprop="sku" content="81980"><meta itemprop="mpn" content="Z438">`;
    const info = parseProductPage(html, "https://www.bestoil.tn/filtres/81980-z438-filtre-a-huile.html", "Filtre à huile MISFAT Z438");
    expect(info.reference).toBe("Z438");
    expect(info.imageUrl).toBe("https://www.bestoil.tn/2522-large_default/z438.jpg");
  });

  it("does not show a shop sku, barcode or retailer id as the maker reference", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Filtre","sku":"4521"}</script>
      <meta itemprop="sku" content="3165143284421">
      <meta property="product:retailer_item_id" content="44001-0">`;
    expect(parseProductPage(html, "https://x.tn/produit/filtre-a-huile-fiat-panda/", "Filtre à huile Fiat Panda").reference).toBeNull();
  });

  it("reads JSON-LD Product (image array, brand object, relative image)", () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
      {"@type":"WebPage"},
      {"@type":"Product","name":"Courroie","sku":"5PK1153","brand":{"@type":"Brand","name":"GATES"},"image":["/img/p/1/7/courroie.jpg"]}]}</script>`;
    const info = parseProductPage(html, "https://www.karhabtk.tn/courroie/75123-courroie.html", "GATES Courroie 5PK1153");
    expect(info).toEqual({
      imageUrl: "https://www.karhabtk.tn/img/p/1/7/courroie.jpg",
      reference: "5PK1153",
      brand: "GATES",
      pageName: "Courroie",
    });
  });

  it("skips logos, category banners, SVG and empty images", () => {
    const html = `<meta property="og:image" content="https://vidange.tn/img/vidange-logo-1635189042.jpg">
      <meta name="twitter:image" content="https://vidange.tn/img/c/389.jpg">
      <img itemprop="image" src="">
      <link rel="image_src" href="https://vidange.tn/icon.svg">`;
    expect(parseProductPage(html, "https://vidange.tn/60044-filtre.html").imageUrl).toBeNull();
  });

  it("survives broken JSON-LD and decodes entities", () => {
    const html = `<script type="application/ld+json">{broken</script>
      <meta property="og:image" content="https://x.tn/a.jpg?w=1&amp;h=2">`;
    expect(parseProductPage(html, "https://x.tn/p.html").imageUrl).toBe("https://x.tn/a.jpg?w=1&h=2");
  });

  it("stays fast on hostile HTML (no catastrophic backtracking)", () => {
    const hostile = [
      '<meta '.repeat(40_000),
      '<meta property="og:image" '.repeat(20_000),
      '<script type="application/ld+json" '.repeat(20_000),
      '<link rel="image_src" '.repeat(20_000),
      '<span itemprop="sku" '.repeat(20_000),
    ];
    for (const html of hostile) {
      const t0 = performance.now();
      parseProductPage(html, "https://x.tn/p.html", "Filtre");
      expect(performance.now() - t0).toBeLessThan(500);
    }
  });
});

describe("pageContradicts", () => {
  const info = (pageName: string, reference: string | null = null) => ({ imageUrl: "https://x.tn/a.jpg", reference, brand: null, pageName });
  it("flags another oil grade or another part number", () => {
    expect(pageContradicts("ELF Evolution Full-Tech C2 5W-30 5 L", null, info("ELF Evolution 900 NF 5W40 5L"))).toBe(true);
    expect(pageContradicts("Filtre à huile MISFAT L008", "L008", info("Filtre à huile Z438", "Z438"))).toBe(true);
  });
  it("accepts matching or generic pages", () => {
    expect(pageContradicts("ELF Evolution Full-Tech C2 5W-30 5 L", null, info("Huile ELF Full-Tech C2 5W-30"))).toBe(false);
    expect(pageContradicts("Filtre à huile MISFAT L008", "L008", info("Filtre à huile", "L008"))).toBe(false);
    expect(pageContradicts("Filtre à huile MISFAT L008", "L008", info("Filtre MISFAT L008", "81980X"))).toBe(false);
    expect(pageContradicts("Filtre", null, { imageUrl: null, reference: null, brand: null, pageName: null })).toBe(false);
  });
});
