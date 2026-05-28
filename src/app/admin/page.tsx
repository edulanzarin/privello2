import {
    PageSurface,
    SectionHeader,
    ShieldIcon,
    TabList,
    TabPanel,
    TabTrigger,
    Tabs,
} from "@/components";

import { listarFilaReports } from "@/server/reports";
import { listarFilaVerificacoes } from "@/server/verification";

import { ReportsAdmin } from "./_admin/ReportsAdmin";
import { VerificacoesAdmin } from "./_admin/VerificacoesAdmin";

export const metadata = { title: "Admin · Privello" };

/**
 * Painel admin.
 *
 * Carrega as 2 filas (verificações pendentes + denúncias pendentes)
 * em paralelo e renderiza num `Tabs` com URL hash. Versão mínima
 * pra moderação — sem RBAC complexo, sem dashboard, sem métricas.
 *
 * Acesso é bloqueado pelo {@link import("./layout").default} via
 * flag `User.isAdmin`.
 */
export default async function AdminPage() {
    const [verificacoes, reports] = await Promise.all([
        listarFilaVerificacoes({ status: "PENDENTE", limit: 100 }),
        listarFilaReports({ status: "PENDENTE", limit: 100 }),
    ]);

    return (
        <PageSurface>
            <SectionHeader
                title="Painel admin"
                subtitle="Triagem de verificações de identidade e denúncias."
                icon={<ShieldIcon size={20} />}
            />

            <Tabs
                defaultValue="verificacoes"
                urlHash
                className="flex flex-col gap-5"
            >
                <TabList aria-label="Áreas do admin">
                    <TabTrigger value="verificacoes">
                        Verificações
                        {verificacoes.length > 0 ? (
                            <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[color:var(--accent)] px-1 text-[0.6rem] font-semibold text-white">
                                {verificacoes.length}
                            </span>
                        ) : null}
                    </TabTrigger>
                    <TabTrigger value="reports">
                        Denúncias
                        {reports.length > 0 ? (
                            <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[color:var(--accent)] px-1 text-[0.6rem] font-semibold text-white">
                                {reports.length}
                            </span>
                        ) : null}
                    </TabTrigger>
                </TabList>

                <TabPanel value="verificacoes">
                    <VerificacoesAdmin
                        items={verificacoes.map((v) => ({
                            id: v.id,
                            userIdentificador: v.userIdentificador,
                            userNome: v.userNome,
                            submetidaEmISO: v.submetidaEm.toISOString(),
                        }))}
                    />
                </TabPanel>
                <TabPanel value="reports">
                    <ReportsAdmin
                        items={reports.map((r) => ({
                            id: r.id,
                            reporterIdentificador: r.reporterIdentificador,
                            reporterNome: r.reporterNome,
                            targetType: r.targetType,
                            targetId: r.targetId,
                            motivo: r.motivo,
                            descricao: r.descricao,
                            criadaEmISO: r.criadaEm.toISOString(),
                        }))}
                    />
                </TabPanel>
            </Tabs>
        </PageSurface>
    );
}
