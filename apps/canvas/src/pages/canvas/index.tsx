import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { App, Button } from "antd";
import { ArrowUpRight, Download, FileUp, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { readZip } from "@/lib/zip";
import { setMediaBlob } from "@/services/file-storage";
import { setImageBlob } from "@/services/image-storage";
import { CanvasDeleteProjectsDialog } from "@/components/canvas/canvas-delete-projects-dialog";
import { CanvasProjectCard } from "@/components/canvas/canvas-project-card";
import type { CanvasExportFile } from "@/types/canvas-export";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useCanvasUiStore } from "@/stores/canvas/use-canvas-ui-store";
import { exportCanvasProjects } from "@/lib/canvas/canvas-export";
import { hasAgentUrlBootstrap } from "@/lib/agent/agent-url-bootstrap";

export default function CanvasPage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const inputRef = useRef<HTMLInputElement>(null);
    const autoOpenRef = useRef(false);
    const hydrated = useCanvasStore((state) => state.hydrated);
    const projects = useCanvasStore((state) => state.projects);
    const createProject = useCanvasStore((state) => state.createProject);
    const importProject = useCanvasStore((state) => state.importProject);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);

    const mode = searchParams.get("mode");
    const agentMode = mode === "new" || mode === "recent" || mode === "choose";
    const agentQuery = agentMode ? `?${searchParams.toString()}` : "";
    const enterProject = (id: string) => {
        const agentHash = hasAgentUrlBootstrap(window.location.hash) ? window.location.hash : "";
        navigate(`/canvas/${id}${agentQuery}${agentHash}`, { replace: Boolean(agentHash) });
    };
    const createAndEnter = () => enterProject(createProject(t("canvas.defaultTitle", { count: projects.length + 1 })));
    const importCanvas = async (file?: File) => {
        if (!file) return;
        try {
            const zip = await readZip(file);
            const projectFile = zip.get("projects.json");
            if (!projectFile) throw new Error("missing projects.json");
            const data = JSON.parse(await projectFile.text()) as CanvasExportFile;
            await Promise.all(
                data.projects.flatMap((project) =>
                    project.files.map(async (item) => {
                        const blob = zip.get(item.path);
                        if (!blob) return;
                        const typedBlob = blob.type ? blob : blob.slice(0, blob.size, item.mimeType);
                        await (item.storageKey.startsWith("image:") ? setImageBlob(item.storageKey, typedBlob) : setMediaBlob(item.storageKey, typedBlob));
                    }),
                ),
            );
            data.projects.forEach((item) => importProject(item.project));
            message.success(t("canvas.imported", { count: data.projects.length }));
        } catch {
            message.error(t("canvas.importFailed"));
        } finally {
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    useEffect(() => {
        if (!hydrated || autoOpenRef.current || (mode !== "new" && mode !== "recent")) return;
        autoOpenRef.current = true;
        enterProject(mode === "new" ? createProject(t("canvas.defaultTitle", { count: projects.length + 1 })) : projects[0]?.id || createProject(t("canvas.defaultTitle", { count: projects.length + 1 })));
    }, [createProject, hydrated, mode, projects, t]);

    if (hydrated && (mode === "new" || mode === "recent")) return <main className="flex h-full items-center justify-center bg-background text-sm text-stone-500">{t("canvas.opening")}</main>;

    return (
        <main className="canvas-library">
            <div className="canvas-library-inner">
                <header className="canvas-library-hero">
                    <div className="canvas-library-intro">
                        <p className="canvas-kicker"><span /> {t("canvas.libraryEyebrow")}</p>
                        <h1>{t("canvas.libraryHeadline")}<br/><em>{t("canvas.libraryHeadlineAccent")}</em></h1>
                        <p className="canvas-library-description">{t("canvas.libraryDescription")}</p>
                        <div className="canvas-hero-actions">
                            <Button disabled={!hydrated} type="primary" icon={<Plus className="size-4" />} onClick={createAndEnter}>{t("canvas.create")}</Button>
                            <Button disabled={!hydrated} icon={<FileUp className="size-4" />} onClick={() => inputRef.current?.click()}>{t("canvas.import")}</Button>
                        </div>
                    </div>
                    <div className="canvas-library-illustration" aria-hidden="true"><span className="canvas-illustration-grid"/><span className="canvas-illustration-card card-one">✳</span><span className="canvas-illustration-card card-two">Aa</span><span className="canvas-illustration-orbit"/><span className="canvas-illustration-label">IDEAS IN PROGRESS <ArrowUpRight size={14}/></span></div>
                </header>
                <section className="canvas-collection" aria-labelledby="canvas-collection-title">
                    <div className="canvas-collection-heading">
                        <div><p className="canvas-kicker">{t("canvas.collectionEyebrow")}</p><h2 id="canvas-collection-title">{t("canvas.title")} <span>{hydrated ? String(projects.length).padStart(2, "0") : "—"}</span></h2><p>{t("canvas.collectionDescription")}</p></div>
                        <div className="canvas-collection-actions">
                            {selectedIds.length ? <><Button disabled={!hydrated} icon={<Download className="size-4" />} onClick={() => void exportCanvasProjects(projects.filter((project) => selectedIds.includes(project.id)), `${t("canvas.title")}-${selectedIds.length}`)}>{t("canvas.exportSelected")}</Button><Button disabled={!hydrated} onClick={() => setDeleteIds(selectedIds)}>{t("canvas.deleteSelected")}</Button></> : null}
                            {projects.length ? <Button disabled={!hydrated} onClick={() => setDeleteIds(projects.map((project) => project.id))}>{t("canvas.deleteAll")}</Button> : null}
                        </div>
                    </div>
                    {!hydrated ? <div className="canvas-library-empty">{t("canvas.loading")}</div> : projects.length ? (
                        <div className="canvas-project-grid">{projects.map((project) => <CanvasProjectCard key={project.id} project={project} />)}</div>
                    ) : (
                        <div className="canvas-library-empty"><div className="canvas-empty-icon"><Plus size={22}/></div><h3>{t("canvas.empty")}</h3><p>{t("canvas.emptyDescription")}</p><Button type="primary" icon={<Plus className="size-4" />} onClick={createAndEnter}>{t("canvas.create")}</Button></div>
                    )}
                </section>
            </div>

            <input ref={inputRef} type="file" accept="application/zip,.zip" className="hidden" onChange={(event) => void importCanvas(event.target.files?.[0])} />
            <CanvasDeleteProjectsDialog />
        </main>
    );
}
