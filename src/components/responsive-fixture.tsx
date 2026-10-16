"use client";
import { useEffect, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { WorkspaceTopbar } from "./workspace-topbar";
import { WorkspaceFrame } from "./workspace-frame";
import { ModelPicker } from "./model-picker";
import { PremiumSelect } from "./premium-select";
export function ResponsiveFixture() {
  const [language, setLanguage] = useState("en");
  const [picker, setPicker] = useState(false);
  const [model, setModel] = useState("");
  useEffect(() => {
    // Mirrors ChatClient's document-level ownership; no submission or session logic.
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setPicker(true);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  return <WorkspaceFrame sidebar={<AppSidebar balance={1234.5} displayName="Layout reviewer" email="fixture@example.invalid" isAdmin={false} language={language} />}
    topbar={<WorkspaceTopbar balance={1234.5} identity="Layout reviewer" offline language={language} />}>
    <section className="responsive-fixture" dir={language === "ur" ? "rtl" : "ltr"}>
      <p className="kicker">Synthetic local workspace / no account or backend</p><h1>Workspace foundation</h1>
      <p>Exercise real navigation, menus, drawers and model library with synthetic content.</p>
      <label>Navigation language<PremiumSelect aria-label="Navigation language" value={language} onChange={setLanguage} options={[{value:"en",label:"English"},{value:"ur",label:"Urdu"},{value:"roman-ur",label:"Roman Urdu"}]} /></label>
      <label>Workspace note<input className="input" placeholder="Write a local note" /></label>
      <button className="btn btn-primary" type="button" onClick={(event) => {event.currentTarget.focus();setPicker(true)}}>Choose fixture model</button>
      <p aria-live="polite">Selected model: {model || "Auto"}</p>
      <div className="responsive-scroll-region" role="region" aria-label="Sample receipts" tabIndex={0}><table><thead><tr><th>Receipt</th><th>Description</th><th>Credits</th></tr></thead><tbody>{Array.from({length:24},(_,i)=><tr key={i}><td>Sample {i+1}</td><td>Long_reference_abcdefghijklmnopqrstuvwxyz_0123456789</td><td>0.00</td></tr>)}</tbody></table></div>
      <p>End of sample content. Navigation must remain reachable.</p>
    </section>
    <ModelPicker models={[{id:"sample",name:"Sample model",providerFamily:"Fixture",tier:"standard",autoEligible:true}]} value={model} onChange={setModel} open={picker} onOpenChange={setPicker} />
  </WorkspaceFrame>;
}
