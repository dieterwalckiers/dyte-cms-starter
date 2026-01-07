#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { App } from './cli.js'

// Parse command line arguments
const args = process.argv.slice(2)
const withTestValues = args.includes('--withTestValues')
const skipToHomePageStep = args.includes('--skipToHomePageStep')

// Extract serviceUrl if provided (--serviceUrl=https://...)
const serviceUrlArg = args.find(arg => arg.startsWith('--serviceUrl='))
const serviceUrl = serviceUrlArg ? serviceUrlArg.split('=')[1] : undefined

// Main entry point
render(<App withTestValues={withTestValues} skipToHomePageStep={skipToHomePageStep} debugServiceUrl={serviceUrl} />)
