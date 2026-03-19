package main

import (
	"fmt"
	"os"

	agentid "agentid-sdk"
)

func main() {
	// 1) Generate a new agent identity.
	agent, err := agentid.GenerateIdentity()
	if err != nil {
		panic(err)
	}

	// 2) Print the agent ID.
	fmt.Printf("Agent ID: %s\n", agent.ID())

	// 3) Generate pseudonyms for two services.
	weatherPseudonym, err := agent.GeneratePseudonym("weather_api")
	if err != nil {
		panic(err)
	}
	researchPseudonym, err := agent.GeneratePseudonym("research_api")
	if err != nil {
		panic(err)
	}

	fmt.Println("Pseudonym (weather_api):", weatherPseudonym)
	fmt.Println("Pseudonym (research_api):", researchPseudonym)

	// 4) Sign and verify a message.
	message := []byte("hello from agentid-sdk")
	signature, err := agent.SignRequest(message)
	if err != nil {
		panic(err)
	}

	isValid := agentid.VerifySignature(agent.PublicKey(), message, signature)
	fmt.Println("Signature valid:", isValid)

	// 5) Persist identity across runs (optional).
	_ = os.MkdirAll(".agentid", 0o700)
	if err := agent.Save(".agentid/identity.json"); err != nil {
		panic(err)
	}
	loaded, err := agentid.Load(".agentid/identity.json")
	if err != nil {
		panic(err)
	}
	fmt.Println("Loaded Agent ID:", loaded.ID())
}