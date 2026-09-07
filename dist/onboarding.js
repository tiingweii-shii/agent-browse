import { a as d, c as R, l as S, o as h, r as PROVIDERS, s as q, t as u } from "./jsxRuntime.module.js";
//#region src/onboarding/OnboardingApp.jsx
/**
* Status-oriented onboarding that checks what's ready and shows what to do next.
* The CLI is the primary setup path. This page is a companion/status surface.
*/
function OnboardingApp() {
	const [status, setStatus] = d({
		loading: true,
		hasCredentials: false,
		credentialSources: [],
		relayConnected: false,
		onboardingCompleted: false
	});
	const [showManualSetup, setShowManualSetup] = d(false);
	const [connecting, setConnecting] = d(false);
	const [connectError, setConnectError] = d("");
	const [selectedApiProvider, setSelectedApiProvider] = d(null);
	const [apiKey, setApiKey] = d("");
	const [customModel, setCustomModel] = d({
		name: "",
		baseUrl: "",
		modelId: "",
		apiKey: ""
	});
	const [copied, setCopied] = d(false);
	const checkStatus = q(async () => {
		try {
			const [config, oauth, codex] = await Promise.all([
				chrome.runtime.sendMessage({ type: "GET_CONFIG" }),
				chrome.runtime.sendMessage({ type: "GET_OAUTH_STATUS" }),
				chrome.runtime.sendMessage({ type: "GET_CODEX_STATUS" })
			]);
			const sources = [];
			if (oauth?.isOAuthEnabled && oauth?.isAuthenticated) sources.push("Claude Code");
			if (codex?.isAuthenticated) sources.push("Codex");
			for (const [id, key] of Object.entries(config?.providerKeys || {})) if (key) sources.push(PROVIDERS[id]?.name || id);
			for (const cm of config?.customModels || []) sources.push(cm.name);
			let relayConnected = false;
			try {
				relayConnected = (await chrome.runtime.sendMessage({ type: "GET_RELAY_STATUS" }))?.connected === true;
			} catch {}
			const obState = await chrome.storage.local.get(["onboarding_completed"]);
			setStatus({
				loading: false,
				hasCredentials: sources.length > 0,
				credentialSources: sources,
				relayConnected,
				onboardingCompleted: obState.onboarding_completed === true
			});
		} catch (err) {
			console.error("Status check failed:", err);
			setStatus((prev) => ({
				...prev,
				loading: false
			}));
		}
	}, []);
	h(() => {
		checkStatus();
		const interval = setInterval(checkStatus, 3e3);
		return () => clearInterval(interval);
	}, [checkStatus]);
	const handleImportClaude = async () => {
		setConnecting(true);
		setConnectError("");
		try {
			const result = await chrome.runtime.sendMessage({ type: "IMPORT_CLI_CREDENTIALS" });
			if (result.success) await checkStatus();
			else setConnectError(result.error || "Could not import Claude credentials. Run `claude login` first.");
		} catch {
			setConnectError("Failed to connect. Is Claude Code installed?");
		}
		setConnecting(false);
	};
	const handleImportCodex = async () => {
		setConnecting(true);
		setConnectError("");
		try {
			const result = await chrome.runtime.sendMessage({ type: "IMPORT_CODEX_CREDENTIALS" });
			if (result.success) await checkStatus();
			else setConnectError(result.error || "Could not import Codex credentials. Run `codex login` first.");
		} catch {
			setConnectError("Failed to connect. Is Codex CLI installed?");
		}
		setConnecting(false);
	};
	const handleSaveApiKey = async () => {
		if (!selectedApiProvider || !apiKey.trim()) return;
		setConnecting(true);
		setConnectError("");
		try {
			const currentConfig = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
			await chrome.runtime.sendMessage({
				type: "SAVE_CONFIG",
				payload: { providerKeys: {
					...currentConfig?.providerKeys || {},
					[selectedApiProvider]: apiKey.trim()
				} }
			});
			setApiKey("");
			setSelectedApiProvider(null);
			await checkStatus();
		} catch {
			setConnectError("Failed to save API key.");
		}
		setConnecting(false);
	};
	const handleSaveCustomModel = async () => {
		if (!customModel.name || !customModel.baseUrl || !customModel.modelId) return;
		setConnecting(true);
		setConnectError("");
		try {
			const currentConfig = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
			await chrome.runtime.sendMessage({
				type: "SAVE_CONFIG",
				payload: { customModels: [...currentConfig?.customModels || [], { ...customModel }] }
			});
			setCustomModel({
				name: "",
				baseUrl: "",
				modelId: "",
				apiKey: ""
			});
			await checkStatus();
		} catch {
			setConnectError("Failed to save custom model.");
		}
		setConnecting(false);
	};
	const markComplete = async () => {
		await chrome.storage.local.set({
			onboarding_completed: true,
			onboarding_completed_at: Date.now(),
			onboarding_version: 2
		});
		await checkStatus();
	};
	if (status.loading) return /* @__PURE__ */ u("div", {
		class: "onboarding-page",
		children: /* @__PURE__ */ u("div", {
			class: "onboarding-container",
			style: { textAlign: "center" },
			children: /* @__PURE__ */ u("p", {
				style: { color: "var(--text-secondary)" },
				children: "Checking status..."
			})
		})
	});
	const isReady = status.hasCredentials;
	return /* @__PURE__ */ u("div", {
		class: "onboarding-page",
		children: /* @__PURE__ */ u("div", {
			class: "onboarding-container",
			children: [/* @__PURE__ */ u("div", {
				class: "onboarding-header",
				children: [
					/* @__PURE__ */ u("div", {
						class: "logo-icon",
						children: /* @__PURE__ */ u("svg", {
							viewBox: "0 0 24 24",
							fill: "none",
							xmlns: "http://www.w3.org/2000/svg",
							children: [/* @__PURE__ */ u("rect", {
								width: "24",
								height: "24",
								rx: "6",
								fill: "currentColor"
							}), /* @__PURE__ */ u("g", {
								stroke: "var(--bg-primary)",
								"stroke-width": "1.6",
								"stroke-linecap": "round",
								"stroke-linejoin": "round",
								children: [
									/* @__PURE__ */ u("circle", {
										cx: "10.5",
										cy: "10.5",
										r: "5.5"
									}),
									/* @__PURE__ */ u("path", { d: "M5 10.5h11M10.5 5c2 2 2 9 0 11M10.5 5c-2 2-2 9 0 11" }),
									/* @__PURE__ */ u("circle", {
										cx: "13",
										cy: "13",
										r: "4",
										fill: "currentColor"
									}),
									/* @__PURE__ */ u("path", { d: "M16 16l3 3" })
								]
							})]
						})
					}),
					/* @__PURE__ */ u("h1", { children: isReady ? "Agent Browse is ready" : "Set up Agent Browse" }),
					/* @__PURE__ */ u("p", {
						class: "subtitle",
						children: isReady ? "Your browser is connected and credentials are configured. You can use Agent Browse from the sidepanel or from your AI agent." : "Agent Browse needs credentials to run browser tasks. The fastest way to get started:"
					})
				]
			}), /* @__PURE__ */ u("div", {
				class: "connect-sections",
				children: [
					!isReady && /* @__PURE__ */ u("div", {
						class: "connect-section",
						children: [/* @__PURE__ */ u("div", {
							class: "command-block",
							style: { margin: "0" },
							children: [/* @__PURE__ */ u("code", { children: "npx hanzi-browse setup" }), /* @__PURE__ */ u("button", {
								class: "copy-btn",
								onClick: () => {
									navigator.clipboard.writeText("npx hanzi-browse setup");
									setCopied(true);
									setTimeout(() => setCopied(false), 2e3);
								},
								children: copied ? "copied!" : "copy"
							})]
						}), /* @__PURE__ */ u("p", {
							class: "connect-hint",
							children: "Run this in your terminal. It detects your AI agents, installs the MCP server, and imports credentials automatically."
						})]
					}),
					/* @__PURE__ */ u("div", {
						class: "connect-section",
						children: [/* @__PURE__ */ u("div", {
							class: "section-kicker",
							children: "Status"
						}), /* @__PURE__ */ u("div", {
							class: "status-list",
							children: [/* @__PURE__ */ u(StatusItem, {
								ok: true,
								label: "Extension installed"
							}), /* @__PURE__ */ u(StatusItem, {
								ok: status.hasCredentials,
								label: "Credentials configured",
								detail: status.hasCredentials ? status.credentialSources.join(", ") : "No model credentials found"
							})]
						})]
					}),
					isReady && !status.onboardingCompleted && /* @__PURE__ */ u("div", {
						class: "connect-section",
						children: [/* @__PURE__ */ u("div", {
							class: "success-banner",
							children: [/* @__PURE__ */ u("svg", {
								viewBox: "0 0 24 24",
								fill: "none",
								stroke: "currentColor",
								"stroke-width": "2",
								width: "20",
								height: "20",
								children: /* @__PURE__ */ u("path", { d: "M20 6L9 17l-5-5" })
							}), "Ready to go. Click the Agent Browse icon in Chrome to open the sidepanel, or use it from your AI agent."]
						}), /* @__PURE__ */ u("div", {
							style: { textAlign: "center" },
							children: /* @__PURE__ */ u("button", {
								class: "btn btn-primary btn-lg",
								onClick: markComplete,
								children: "Got it"
							})
						})]
					}),
					isReady && status.onboardingCompleted && /* @__PURE__ */ u("div", {
						class: "connect-section",
						children: [/* @__PURE__ */ u("div", {
							class: "section-kicker",
							children: "Next steps"
						}), /* @__PURE__ */ u("div", {
							class: "done-sections",
							children: [/* @__PURE__ */ u("div", {
								class: "done-section",
								children: [/* @__PURE__ */ u("h3", { children: "Use from your AI agent" }), /* @__PURE__ */ u("p", {
									class: "section-intro",
									children: "Restart your agent (Claude Code, Cursor, etc.) and ask it to do something in the browser. The MCP tools are ready."
								})]
							}), /* @__PURE__ */ u("div", {
								class: "done-section",
								children: [/* @__PURE__ */ u("h3", { children: "Use from the Chrome sidepanel" }), /* @__PURE__ */ u("p", {
									class: "section-intro",
									children: "Click the Agent Browse icon in your Chrome toolbar to open the sidepanel. Describe a task and it will browse for you."
								})]
							})]
						})]
					}),
					!isReady && /* @__PURE__ */ u("div", {
						class: "connect-section",
						children: /* @__PURE__ */ u("button", {
							class: `quick-connect-card ${showManualSetup ? "selected" : ""}`,
							onClick: () => setShowManualSetup(!showManualSetup),
							style: { width: "100%" },
							children: [/* @__PURE__ */ u("div", {
								class: "quick-connect-head",
								children: [/* @__PURE__ */ u("span", {
									class: "quick-connect-title",
									children: "Or set up credentials here"
								}), /* @__PURE__ */ u("span", {
									class: "quick-connect-pill",
									children: showManualSetup ? "hide" : "expand"
								})]
							}), /* @__PURE__ */ u("span", {
								class: "quick-connect-desc",
								children: "If you prefer not to use the CLI, you can import credentials directly."
							})]
						})
					}),
					connectError && /* @__PURE__ */ u("div", {
						class: "error-banner",
						children: connectError
					}),
					showManualSetup && !isReady && /* @__PURE__ */ u(S, { children: [/* @__PURE__ */ u("div", {
						class: "connect-section",
						children: [/* @__PURE__ */ u("div", {
							class: "quick-connect-grid",
							children: [
								/* @__PURE__ */ u("button", {
									class: `quick-connect-card ${status.credentialSources.includes("Claude Code") ? "connected" : ""}`,
									onClick: handleImportClaude,
									disabled: connecting || status.credentialSources.includes("Claude Code"),
									children: [/* @__PURE__ */ u("div", {
										class: "quick-connect-head",
										children: [/* @__PURE__ */ u("span", {
											class: "quick-connect-title",
											children: "Claude Code"
										}), status.credentialSources.includes("Claude Code") && /* @__PURE__ */ u("span", {
											class: "check-mark",
											children: "connected"
										})]
									}), /* @__PURE__ */ u("span", {
										class: "quick-connect-desc",
										children: "Import from `claude login`"
									})]
								}),
								/* @__PURE__ */ u("button", {
									class: `quick-connect-card ${status.credentialSources.includes("Codex") ? "connected" : ""}`,
									onClick: handleImportCodex,
									disabled: connecting || status.credentialSources.includes("Codex"),
									children: [/* @__PURE__ */ u("div", {
										class: "quick-connect-head",
										children: [/* @__PURE__ */ u("span", {
											class: "quick-connect-title",
											children: "Codex"
										}), status.credentialSources.includes("Codex") && /* @__PURE__ */ u("span", {
											class: "check-mark",
											children: "connected"
										})]
									}), /* @__PURE__ */ u("span", {
										class: "quick-connect-desc",
										children: "Import from `codex login`"
									})]
								}),
								/* @__PURE__ */ u("button", {
									class: `quick-connect-card ${selectedApiProvider ? "selected" : ""}`,
									onClick: () => {
										setSelectedApiProvider(selectedApiProvider ? null : "anthropic");
									},
									disabled: connecting,
									children: [/* @__PURE__ */ u("div", {
										class: "quick-connect-head",
										children: [/* @__PURE__ */ u("span", {
											class: "quick-connect-title",
											children: "API key"
										}), /* @__PURE__ */ u("span", {
											class: "quick-connect-pill",
											children: selectedApiProvider ? "open" : "choose"
										})]
									}), /* @__PURE__ */ u("span", {
										class: "quick-connect-desc",
										children: "Anthropic, OpenAI, Google, OpenRouter"
									})]
								})
							]
						}), selectedApiProvider && /* @__PURE__ */ u("div", {
							class: "nested-panel",
							children: [/* @__PURE__ */ u("div", {
								class: "api-provider-grid",
								children: Object.entries(PROVIDERS).map(([id, provider]) => /* @__PURE__ */ u("button", {
									class: `api-provider-btn ${selectedApiProvider === id ? "selected" : ""}`,
									onClick: () => setSelectedApiProvider(id),
									children: provider.name
								}, id))
							}), /* @__PURE__ */ u("div", {
								class: "api-key-entry",
								children: [/* @__PURE__ */ u("input", {
									type: "password",
									placeholder: `${PROVIDERS[selectedApiProvider]?.name?.toLowerCase() || ""} API key`,
									value: apiKey,
									onInput: (e) => setApiKey(e.target.value),
									onKeyDown: (e) => e.key === "Enter" && handleSaveApiKey()
								}), /* @__PURE__ */ u("button", {
									class: "btn btn-primary",
									onClick: handleSaveApiKey,
									disabled: !apiKey.trim() || connecting,
									children: connecting ? "saving..." : "save"
								})]
							})]
						})]
					}), /* @__PURE__ */ u("div", {
						class: "connect-section",
						children: /* @__PURE__ */ u("details", {
							class: "advanced-section",
							children: [
								/* @__PURE__ */ u("summary", { children: "Custom endpoint (Ollama, LM Studio, etc.)" }),
								/* @__PURE__ */ u("p", {
									class: "connect-hint",
									style: { marginBottom: "12px" },
									children: [
										"Any OpenAI-compatible endpoint. Works with Ollama (",
										/* @__PURE__ */ u("code", { children: "http://localhost:11434/v1" }),
										"), LM Studio, vLLM, etc."
									]
								}),
								/* @__PURE__ */ u("div", {
									class: "custom-model-form",
									children: [
										/* @__PURE__ */ u("input", {
											type: "text",
											placeholder: "Display name",
											value: customModel.name,
											onInput: (e) => setCustomModel({
												...customModel,
												name: e.target.value
											})
										}),
										/* @__PURE__ */ u("input", {
											type: "text",
											placeholder: "Base URL (e.g. http://localhost:11434/v1)",
											value: customModel.baseUrl,
											onInput: (e) => setCustomModel({
												...customModel,
												baseUrl: e.target.value
											})
										}),
										/* @__PURE__ */ u("input", {
											type: "text",
											placeholder: "Model ID",
											value: customModel.modelId,
											onInput: (e) => setCustomModel({
												...customModel,
												modelId: e.target.value
											})
										}),
										/* @__PURE__ */ u("input", {
											type: "password",
											placeholder: "API key (optional)",
											value: customModel.apiKey,
											onInput: (e) => setCustomModel({
												...customModel,
												apiKey: e.target.value
											})
										}),
										/* @__PURE__ */ u("button", {
											class: "btn btn-primary",
											onClick: handleSaveCustomModel,
											disabled: !customModel.name || !customModel.baseUrl || !customModel.modelId || connecting,
											children: connecting ? "saving..." : "add model"
										})
									]
								})
							]
						})
					})] })
				]
			})]
		})
	});
}
function StatusItem({ ok, label, detail }) {
	return /* @__PURE__ */ u("div", {
		class: "status-item",
		children: [
			/* @__PURE__ */ u("span", {
				class: `status-dot ${ok ? "ok" : "pending"}`,
				children: ok ? /* @__PURE__ */ u("svg", {
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					"stroke-width": "3",
					width: "14",
					height: "14",
					children: /* @__PURE__ */ u("path", { d: "M20 6L9 17l-5-5" })
				}) : /* @__PURE__ */ u("svg", {
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					"stroke-width": "3",
					width: "14",
					height: "14",
					children: /* @__PURE__ */ u("circle", {
						cx: "12",
						cy: "12",
						r: "4"
					})
				})
			}),
			/* @__PURE__ */ u("span", {
				class: "status-label",
				children: label
			}),
			detail && /* @__PURE__ */ u("span", {
				class: "status-detail",
				children: detail
			})
		]
	});
}
//#endregion
//#region src/onboarding/main.jsx
R(/* @__PURE__ */ u(OnboardingApp, {}), document.getElementById("app"));
//#endregion

//# sourceMappingURL=onboarding.js.map