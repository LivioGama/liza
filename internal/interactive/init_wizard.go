package interactive

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/charmbracelet/huh"
)

// InitWizardResult holds all choices made during the interactive init wizard.
type InitWizardResult struct {
	Mode           string   // "pairing" or "full"
	Agents         []string // selected agents (e.g. "claude", "codex")
	Description    string   // project goal (full mode only)
	SpecRef        string   // spec file path (full mode only)
	EntryPoint     string   // entry point (full mode only)
	ContractAction string   // "global", "rename", "skip" (only if conflict detected)
}

// agentRepoSymlinks maps agent names to repo-root contract filenames.
var agentRepoSymlinks = map[string]string{
	"claude": "CLAUDE.md",
	"codex":  "AGENTS.md",
	"gemini": "GEMINI.md",
}

// RunInitWizard runs the interactive init wizard and returns the user's choices.
// Returns nil result if user aborts (Ctrl+C / Esc).
func RunInitWizard(projectRoot string) (*InitWizardResult, error) {
	result := &InitWizardResult{
		SpecRef: "specs/vision.md",
	}

	// Screen 1: Mode selection
	err := huh.NewSelect[string]().
		Title("How would you like to use Liza?").
		Options(
			huh.NewOption("Start with Pairing — AI agents follow Liza quality contracts (recommended for first use)", "pairing"),
			huh.NewOption("Full Multi-Agent System — Orchestrated workspace with sprints, reviews, and task decomposition", "full"),
		).
		Value(&result.Mode).
		Run()
	if err != nil {
		return nil, err
	}

	// Screen 2: Agent selection
	err = huh.NewMultiSelect[string]().
		Title("Which agents do you want to enable?").
		Options(
			huh.NewOption("Claude  (creates CLAUDE.md)", "claude").Selected(true),
			huh.NewOption("Codex   (creates AGENTS.md)", "codex"),
			huh.NewOption("Gemini  (creates GEMINI.md)", "gemini"),
			huh.NewOption("Mistral (sets up ~/.vibe/)", "mistral"),
		).
		Value(&result.Agents).
		Validate(func(agents []string) error {
			if len(agents) == 0 {
				return fmt.Errorf("select at least one agent")
			}
			return nil
		}).
		Run()
	if err != nil {
		return nil, err
	}

	// Screen 3 (full mode only): Project details
	if result.Mode == "full" {
		err = huh.NewForm(
			huh.NewGroup(
				huh.NewInput().
					Title("Project description").
					Placeholder("e.g., Build a REST API for task management").
					Value(&result.Description).
					Validate(func(s string) error {
						if s == "" {
							return fmt.Errorf("description is required")
						}
						return nil
					}),
				huh.NewInput().
					Title("Spec file path").
					Value(&result.SpecRef),
				huh.NewSelect[string]().
					Title("Entry point").
					Description("How should the orchestrator classify your spec?").
					Options(
						huh.NewOption("Auto — let the orchestrator decide", ""),
						huh.NewOption("General Objective — full pipeline (epics → stories → code)", "general-objective"),
						huh.NewOption("Detailed Spec — coding only (code planning → coding)", "detailed-spec"),
					).
					Value(&result.EntryPoint),
			),
		).Run()
		if err != nil {
			return nil, err
		}
	}

	// Screen 4: Contract conflict resolution (if needed)
	if err := resolveContractConflicts(projectRoot, result); err != nil {
		return nil, err
	}

	return result, nil
}

// resolveContractConflicts checks if any contract files conflict and prompts the user.
func resolveContractConflicts(projectRoot string, result *InitWizardResult) error {
	if projectRoot == "" {
		return nil
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil // non-fatal, let the init command handle it
	}
	contractTarget := filepath.Join(homeDir, ".liza", "CORE.md")

	for _, agent := range result.Agents {
		fileName, ok := agentRepoSymlinks[agent]
		if !ok {
			continue // mistral doesn't use repo-root symlinks
		}

		repoPath := filepath.Join(projectRoot, fileName)

		// Check if file exists and is NOT already a Liza symlink
		fi, err := os.Lstat(repoPath)
		if err != nil {
			continue // doesn't exist, no conflict
		}

		// If it's already a Liza symlink, skip
		if fi.Mode()&os.ModeSymlink != 0 {
			target, readErr := os.Readlink(repoPath)
			if readErr == nil && target == contractTarget {
				continue // already correct
			}
		}

		// Conflict detected — ask user
		var action string
		err = huh.NewSelect[string]().
			Title(fmt.Sprintf("%s already exists. Where should Liza place its contract?", fileName)).
			Options(
				huh.NewOption(fmt.Sprintf("Use global config instead (keeps your existing %s)", fileName), "global"),
				huh.NewOption(fmt.Sprintf("Rename existing to %s.bak and place Liza contract at repo root", fileName), "rename"),
				huh.NewOption("Skip — don't create this contract", "skip"),
			).
			Value(&action).
			Run()
		if err != nil {
			return err
		}

		// Use the first conflict's action for all (they'll likely all have the same issue)
		result.ContractAction = action
		return nil
	}

	return nil
}
