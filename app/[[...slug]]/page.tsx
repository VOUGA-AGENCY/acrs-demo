import { Application } from "@/components/application";
import summary from "@/data/source/excel-summary.json";
export function generateStaticParams() {
  return [
    [],
    ["obras"],
    ["armazem"],
    ["armazem", "recursos"],
    ["armazem", "stock"],
    ["armazem", "movimentos"],
    ["armazem", "consumo"],
    ["armazem", "maquinas"],
    ["armazem", "tablet"],
    ["faturas"],
    ["pessoas", "ponto"],
    ["pessoas", "colaboradores"],
    ["pessoas", "empresas"],
    ["orcamentos"],
    ["controlo"],
    ["configuracao"],
    ["campo"],
    ...summary.obraIdsSelecionadas.map((id) => ["obras", id]),
    ["obras", "demo-nova-obra"],
  ].map((slug) => ({ slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <Application segments={slug} />;
}
