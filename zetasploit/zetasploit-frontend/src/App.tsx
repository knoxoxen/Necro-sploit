import React, { useState, useEffect, useRef } from 'react';
import { Navbar, Container, Nav, Form, FormControl, Button, Row, Col, ListGroup, NavDropdown, Accordion } from 'react-bootstrap';
import './App.css';

interface Spell {
  type: string;
  name: string;
}

interface Soul {
  name: string;
  description: string;
}

interface SoulsByRealm {
  [platform: string]: Soul[];
}

interface GrimoireData {
  payloads: SoulsByRealm;
  encoders: { [arch: string]: string[] };
  formats: { [platform: string]: string[] };
}

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [spells, setSpells] = useState<{[key: string]: {[platform: string]: Spell[]}}>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);
  const [spellDetails, setSpellDetails] = useState<any>(null);
  const [spellOptions, setSpellOptions] = useState<{[key: string]: any}>({});
  const [castingResult, setCastingResult] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const [realms, setRealms] = useState<string[]>([]);
  const [selectedRealm, setSelectedRealm] = useState<string>('');
  const [selectedSpellType, setSelectedSpellType] = useState<string>('');

  const [activeRituals, setActiveRituals] = useState<any[]>([]);
  const [showRituals, setShowRituals] = useState<boolean>(false);

  const [grimoireData, setGrimoireData] = useState<GrimoireData>({ payloads: {}, encoders: {}, formats: {} });
  const [selectedSoul, setSelectedSoul] = useState<string>('');
  const [soulOptions, setSoulOptions] = useState<{[key: string]: any}>({});
  const [soulEncoder, setSoulEncoder] = useState<string>('');
  const [soulIterations, setSoulIterations] = useState<string>('');
  const [soulTemplate, setSoulTemplate] = useState<string>('');
  const [soulFormat, setSoulFormat] = useState<string>('raw');
  const [soulGenerationResult, setSoulGenerationResult] = useState<string | null>(null);

  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidOutput, setVoidOutput] = useState<string>('');
  const [voidCommand, setVoidCommand] = useState<string>('');

  const voidOutputRef = useRef<HTMLPreElement>(null);


  const spellTypes = ['exploits', 'payloads', 'auxiliary', 'post', 'encoders', 'nops'];

  const fetchSpells = async (query: string = '', realm: string = '', spellType: string = '') => {
    setLoading(true);
    setError(null);
    if (!apiKey) {
      setError("API Key not available. Please refresh the page.");
      setLoading(false);
      return;
    }
    try {
      let url = `http://localhost:5000/modules/search?q=${query}`;
      if (realm) {
        url += `&platform=${realm}`;
      }
      if (spellType) {
        url += `&module_type=${spellType}`;
      }
      const response = await fetch(url, {
        headers: {
          'X-API-Key': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Spell[] = await response.json();
      const groupedSpells: {[key: string]: {[platform: string]: Spell[]}} = {};
      data.forEach(spell => {
        if (!groupedSpells[spell.type]) {
          groupedSpells[spell.type] = {};
        }

        const nameParts = spell.name.split('/');
        let realm = 'Other';
        if (nameParts.length > 1) {
          if (spell.type === 'exploits' && nameParts[0] === 'multi' && nameParts[1] === 'handler') {
            realm = 'multi';
          } else {
            realm = nameParts[0];
          }
        }

        if (!groupedSpells[spell.type][realm]) {
          groupedSpells[spell.type][realm] = [];
        }
        groupedSpells[spell.type][realm].push(spell);
      });
      setSpells(groupedSpells);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRealms = async () => {
    if (!apiKey) return;
    try {
      const response = await fetch(`http://localhost:5000/platforms`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: string[] = await response.json();
      setRealms(data);
    } catch (e: any) {
      console.error("Error fetching realms:", e);
    }
  };

  const fetchRituals = async () => {
    if (!apiKey) return;
    try {
      const response = await fetch(`http://localhost:5000/jobs`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setActiveRituals(Object.values(data)); // Metasploit RPC returns jobs as an object with job IDs as keys
    } catch (e: any) {
      console.error("Error fetching rituals:", e);
    }
  };

  const fetchGrimoireData = async () => {
    if (!apiKey) return;
    try {
      const response = await fetch(`http://localhost:5000/msfvenom/payloads`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: GrimoireData = await response.json();
      setGrimoireData(data);
    } catch (e: any) {
      console.error("Error fetching grimoire data:", e);
    }
  };

  const createVoid = async () => {
    if (!apiKey) return;
    try {
      const response = await fetch(`http://localhost:5000/console/create`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setVoidId(data.console_id);
    } catch (e: any) {
      console.error("Error creating void:", e);
    }
  };

  const readVoid = async () => {
    if (!apiKey || !voidId) return;
    try {
      const response = await fetch(`http://localhost:5000/console/read?console_id=${voidId}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.data) {
        setVoidOutput(prevOutput => prevOutput + data.data);
      }
    } catch (e: any) {
      console.error("Error reading from void:", e);
    }
  };

  const writeToVoid = async () => {
    if (!apiKey || !voidId || !voidCommand) return;
    try {
      await fetch(`http://localhost:5000/console/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ console_id: voidId, command: voidCommand + '\n' }),
      });
      setVoidCommand('');
      readVoid(); // Immediately read after writing
    } catch (e: any) {
      console.error("Error writing to void:", e);
    }
  };

  useEffect(() => {
    const getApiKey = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api_key`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setApiKey(data.api_key);
      } catch (e: any) {
        console.error("Error fetching API key:", e);
        setError("Could not fetch API key. Please ensure backend is running.");
      }
    };

    getApiKey();
  }, []);

  useEffect(() => {
    if (apiKey) {
      fetchSpells();
      fetchRealms();
      fetchRituals(); // Fetch rituals on API key availability
      fetchGrimoireData();
      createVoid(); // Create void once API key is available

      const ritualInterval = setInterval(fetchRituals, 5000); // Poll for rituals every 5 seconds
      const voidInterval = setInterval(readVoid, 500); // Poll for void output

      return () => {
        clearInterval(ritualInterval);
        clearInterval(voidInterval);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Auto-scroll void output
  useEffect(() => {
    if (voidOutputRef.current) {
      voidOutputRef.current.scrollTop = voidOutputRef.current.scrollHeight;
    }
  }, [voidOutput]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    fetchSpells(searchTerm, selectedRealm, selectedSpellType);
  };

  const handleSpellDoubleClick = async (spell: Spell) => {
    setSelectedSpell(spell);
    setLoading(true);
    setError(null);
    if (!apiKey) {
      setError("API Key not available. Please refresh the page.");
      setLoading(false);
      return;
    }
    try {
      let singularType = spell.type;
      if (spell.type === 'auxiliary') {
        singularType = 'auxiliary';
      } else if (spell.type === 'payloads') {
        singularType = 'payload';
      }
      else if (spell.type.endsWith('s')) {
        singularType = spell.type.slice(0, -1);
      }
      const response = await fetch(`http://localhost:5000/modules/${singularType}/${spell.name}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSpellDetails(data);
      // Initialize spell options with default values
      const initialOptions: {[key: string]: any} = {};
      for (const opt in data.options) {
        initialOptions[opt] = data.options[opt].default;
      }
      for (const opt in data.advanced_options) {
        initialOptions[opt] = data.advanced_options[opt].default;
      }
      for (const opt in data.evasion_options) {
        initialOptions[opt] = data.evasion_options[opt].default;
      }
      setSpellOptions(initialOptions);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (optionName: string, value: string) => {
    setSpellOptions(prevOptions => ({
      ...prevOptions,
      [optionName]: value
    }));
  };

  const handleCastSpell = async () => {
    if (!selectedSpell) return;

    if (!apiKey) {
      setError("API Key not available. Please refresh the page.");
      setLoading(false);
      return;
    }

    // Basic validation for required options
    const missingRequiredOptions = Object.entries(spellDetails.options).filter(([key, value]: [string, any]) =>
      value.required && !spellOptions[key]
    );

    if (missingRequiredOptions.length > 0) {
      setError(`Missing required options: ${missingRequiredOptions.map(([key]) => key).join(', ')}`);
      return;
    }

    setLoading(true);
    setCastingResult(null);
    setError(null);

    try {
      const response = await fetch(`http://localhost:5000/modules/${selectedSpell.type}/${selectedSpell.name}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ options: spellOptions }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setCastingResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopRitual = async (jobId: string) => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/jobs/${jobId}/stop`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // After stopping, refetch rituals to update the list
      fetchRituals();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSoulChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSoul(event.target.value);
  };

  const handleSoulOptionChange = (optionName: string, value: string) => {
    setSoulOptions(prevOptions => ({
      ...prevOptions,
      [optionName]: value
    }));
  };

  const handleSoulEncoderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSoulEncoder(event.target.value);
  };

  const handleSoulIterationsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSoulIterations(event.target.value);
  };

  const handleSoulTemplateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSoulTemplate(event.target.value);
  };

  const handleSoulFormatChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSoulFormat(event.target.value);
  };

  const handleGenerateSoul = async () => {
    if (!selectedSoul) return;

    if (!apiKey) {
      setError("API Key not available. Please refresh the page.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setSoulGenerationResult(null);
    setError(null);

    try {
      const response = await fetch(`http://localhost:5000/msfvenom/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ 
          payload: selectedSoul, 
          options: soulOptions, 
          format: soulFormat,
          encoder: soulEncoder,
          iterations: soulIterations,
          template: soulTemplate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSoulGenerationResult(data.file_path);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVoidCommandSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setVoidOutput(prevOutput => prevOutput + `msf6 > ${voidCommand}\n`); // Immediately show command
    writeToVoid();
  };

  return (
    <div className="App">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container fluid>
          <Navbar.Brand href="#home">NecroSploit</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link href="#home">Grimoire</Nav.Link>
              <Nav.Link href="#modules">Spells</Nav.Link>
              <Nav.Link onClick={() => setShowRituals(!showRituals)}>{showRituals ? "Hide Rituals" : "Show Rituals"}</Nav.Link>
            </Nav>
            <Form className="d-flex" onSubmit={handleSearchSubmit}>
              <FormControl
                type="search"
                placeholder="Search for Spells"
                className="me-2"
                aria-label="Search"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <NavDropdown title={selectedSpellType ? selectedSpellType.charAt(0).toUpperCase() + selectedSpellType.slice(1) : "Spell Type"} id="spell-type-dropdown" className="me-2">
                <NavDropdown.Item onClick={() => { setSelectedSpellType(''); setSelectedRealm(''); fetchSpells(searchTerm, '', ''); }}>All Types</NavDropdown.Item>
                {spellTypes.map(type => (
                  <NavDropdown
                    key={type}
                    title={type.charAt(0).toUpperCase() + type.slice(1)}
                    id={`dropdown-${type}`}
                    drop="end"
                  >
                    <NavDropdown.Item onClick={() => { setSelectedSpellType(type); setSelectedRealm(''); fetchSpells(searchTerm, '', type); }}>All Realms</NavDropdown.Item>
                    {realms.map(realm => (
                      <NavDropdown.Item key={realm} onClick={() => { setSelectedSpellType(type); setSelectedRealm(realm); fetchSpells(searchTerm, realm, type); }}>
                        {realm.charAt(0).toUpperCase() + realm.slice(1)}
                      </NavDropdown.Item>
                    ))}
                  </NavDropdown>
                ))}
              </NavDropdown>
              <Button variant="outline-success" type="submit">Search</Button>
            </Form>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container className="mt-4">
        <h1>Welcome to NecroSploit</h1>
        <p>Your Grimoire for the Dark Arts of Metasploit.</p>

        <Row>
          <Col md={6}>
            <h2 className="mt-5">Soul Forge</h2>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label><strong>Select Soul</strong></Form.Label>
                <Form.Select onChange={handleSoulChange} value={selectedSoul}>
                  <option value="">Select a Soul to Bind</option>
                  {Object.entries(grimoireData.payloads).map(([realm, souls]) => (
                    <optgroup key={realm} label={realm}>
                      {souls.map(soul => (
                        <option key={soul.name} value={soul.name}>{soul.name} - {soul.description}</option>
                      ))}
                    </optgroup>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label><strong>LHOST</strong></Form.Label>
                <Form.Control type="text" placeholder="e.g., 192.168.1.10" onChange={(e) => handleSoulOptionChange('LHOST', e.target.value)} />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label><strong>LPORT</strong></Form.Label>
                <Form.Control type="text" placeholder="e.g., 4444" onChange={(e) => handleSoulOptionChange('LPORT', e.target.value)} />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label><strong>Encoder</strong></Form.Label>
                <Form.Select onChange={handleSoulEncoderChange} value={soulEncoder}>
                  <option value="">Select an Encoder</option>
                  {Object.entries(grimoireData.encoders).map(([arch, encoders]) => (
                    <optgroup key={arch} label={arch}>
                      {encoders.map(encoder => (
                        <option key={encoder} value={encoder}>{encoder}</option>
                      ))}
                    </optgroup>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label><strong>Iterations</strong></Form.Label>
                <Form.Control type="number" placeholder="e.g., 5" onChange={handleSoulIterationsChange} />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label><strong>Template (optional)</strong></Form.Label>
                <Form.Control type="text" placeholder="e.g., /path/to/template.exe" onChange={handleSoulTemplateChange} />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label><strong>Output Format</strong></Form.Label>
                <Form.Select onChange={handleSoulFormatChange} value={soulFormat}>
                  <option value="">Select a Format</option>
                  {Object.entries(grimoireData.formats).map(([realm, formats]) => (
                    <optgroup key={realm} label={realm}>
                      {formats.map(format => (
                        <option key={format} value={format}>{format}</option>
                      ))}
                    </optgroup>
                  ))}
                </Form.Select>
              </Form.Group>

              <Button variant="primary" onClick={handleGenerateSoul} disabled={loading || !selectedSoul}>
                {loading ? 'Forging...' : 'Forge Soul'}
              </Button>
            </Form>
            {soulGenerationResult && (
              <div className="mt-3">
                <h4>Soul Forged:</h4>
                <p>Your soul has been forged and saved to: <code>{soulGenerationResult}</code></p>
                <p>You can now retrieve it from the server.</p>
              </div>
            )}
          </Col>
          <Col md={6}>
            <h2 className="mt-5">The Void</h2>
            <div className="console-output">
              <pre ref={voidOutputRef}>{voidOutput}</pre>
            </div>
            <Form onSubmit={handleVoidCommandSubmit}>
              <FormControl
                type="text"
                placeholder="Whisper to The Void"
                className="mt-2"
                value={voidCommand}
                onChange={(e) => setVoidCommand(e.target.value)}
              />
            </Form>
          </Col>
        </Row>

        <h2 className="mt-5">Book of Spells</h2>
        {!showRituals && (
          <>
            {loading && <p>Reading the ancient texts...</p>}
            {error && <p className="text-danger">Error: {error}</p>}
            {!loading && !error && Object.keys(spells).length === 0 && <p>No spells found.</p>}
            {!loading && !error && Object.keys(spells).length > 0 && (
              <Row>
                <Col>
                  <Accordion alwaysOpen>
                    {Object.entries(spells).map(([type, realmGroups]) => (
                      <Accordion.Item eventKey={type} key={type}>
                        <Accordion.Header>{type.charAt(0).toUpperCase() + type.slice(1)} Spells</Accordion.Header>
                        <Accordion.Body>
                          <Accordion alwaysOpen>
                            {Object.entries(realmGroups).map(([realm, spellList]) => (
                              <Accordion.Item eventKey={realm} key={realm}>
                                <Accordion.Header>{realm.charAt(0).toUpperCase() + realm.slice(1)}</Accordion.Header>
                                <Accordion.Body>
                                  <ListGroup>
                                    {spellList.map((spell, index) => (
                                      <ListGroup.Item key={index} onDoubleClick={() => handleSpellDoubleClick(spell)}>
                                        <strong>{spell.name}</strong>
                                      </ListGroup.Item>
                                    ))}
                                  </ListGroup>
                                </Accordion.Body>
                              </Accordion.Item>
                            ))}
                          </Accordion>
                        </Accordion.Body>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                </Col>
                {selectedSpell && spellDetails && (
                  <Col>
                    <h2>{selectedSpell.name} Details</h2>
                    <p><strong>Type:</strong> {selectedSpell.type}</p>
                    <p><strong>Description:</strong> {spellDetails.description}</p>
                    <Accordion alwaysOpen>
                      <Accordion.Item eventKey="0">
                        <Accordion.Header>Incantations</Accordion.Header>
                        <Accordion.Body>
                          {Object.keys(spellDetails.options).length > 0 ? (
                            <Form>
                              {Object.entries(spellDetails.options).map(([key, value]: [string, any]) => (
                                <Form.Group className="mb-3" key={key}>
                                  <Form.Label><strong>{key}</strong> - {value.desc} ({value.type}, {value.required ? 'required*' : 'optional'})</Form.Label>
                                  {value.type === 'bool' ? (
                                    <Form.Check
                                      type="checkbox"
                                      checked={spellOptions[key] === true || spellOptions[key] === 'true'}
                                      onChange={(e) => handleOptionChange(key, e.target.checked ? 'true' : 'false')}
                                    />
                                  ) : value.type === 'enum' ? (
                                    <Form.Select
                                      value={spellOptions[key] || ''}
                                      onChange={(e) => handleOptionChange(key, e.target.value)}
                                    >
                                      {value.enums.map((enumValue: string) => (
                                        <option key={enumValue} value={enumValue}>{enumValue}</option>
                                      ))}
                                    </Form.Select>
                                  ) : value.type === 'integer' ? (
                                    <Form.Control
                                      type="number"
                                      value={spellOptions[key] || ''}
                                      onChange={(e) => handleOptionChange(key, e.target.value)}
                                      placeholder={value.default ? `Default: ${value.default}` : ''}
                                    />
                                  ) : (
                                    <Form.Control
                                      type="text"
                                      value={spellOptions[key] || ''}
                                      onChange={(e) => handleOptionChange(key, e.target.value)}
                                      placeholder={value.default ? `Default: ${value.default}` : ''}
                                    />
                                  )}
                                </Form.Group>
                              ))}
                            </Form>
                          ) : (
                            <p>No incantations available.</p>
                          )}
                        </Accordion.Body>
                      </Accordion.Item>
                      <Accordion.Item eventKey="1">
                        <Accordion.Header>Advanced Incantations</Accordion.Header>
                        <Accordion.Body>
                          {Object.keys(spellDetails.advanced_options).length > 0 ? (
                            <Form>
                              {Object.entries(spellDetails.advanced_options).map(([key, value]: [string, any]) => (
                                <Form.Group className="mb-3" key={key}>
                                  <Form.Label><strong>{key}</strong> - {value.desc} ({value.type}, {value.required ? 'required*' : 'optional'})</Form.Label>
                                  {value.type === 'bool' ? (
                                    <Form.Check
                                      type="checkbox"
                                      checked={spellOptions[key] === true || spellOptions[key] === 'true'}
                                      onChange={(e) => handleOptionChange(key, e.target.checked ? 'true' : 'false')}
                                    />
                                  ) : value.type === 'enum' ? (
                                    <Form.Select
                                      value={spellOptions[key] || ''}
                                      onChange={(e) => handleOptionChange(key, e.target.value)}
                                    >
                                      {value.enums.map((enumValue: string) => (
                                        <option key={enumValue} value={enumValue}>{enumValue}</option>
                                      ))}
                                    </Form.Select>
                                  ) : value.type === 'integer' ? (
                                    <Form.Control
                                      type="number"
                                      value={spellOptions[key] || ''}
                                      onChange={(e) => handleOptionChange(key, e.target.value)}
                                      placeholder={value.default ? `Default: ${value.default}` : ''}
                                    />
                                  ) : (
                                    <Form.Control
                                      type="text"
                                      value={spellOptions[key] || ''}
                                      onChange={(e) => handleOptionChange(key, e.target.value)}
                                      placeholder={value.default ? `Default: ${value.default}` : ''}
                                    />
                                  )}
                                </Form.Group>
                              ))}
                            </Form>
                          ) : (
                            <p>No advanced incantations available.</p>
                          )}
                        </Accordion.Body>
                      </Accordion.Item>
                      <Accordion.Item eventKey="2">
                        <Accordion.Header>Evasion Incantations</Accordion.Header>
                        <Accordion.Body>
                          {Object.keys(spellDetails.evasion_options).length > 0 ? (
                            <Form>
                              {Object.entries(spellDetails.evasion_options).map(([key, value]: [string, any]) => (
                                <Form.Group className="mb-3" key={key}>
                                  <Form.Label><strong>{key}</strong> - {value.desc} ({value.type}, {value.required ? 'required*' : 'optional'})</Form.Label>
                                  {value.type === 'bool' ? (
                                    <Form.Check
                                      type="checkbox"
                                      checked={spellOptions[key] === true || spellOptions[key] === 'true'}
                                      onChange={(e) => handleOptionChange(key, e.target.checked ? 'true' : 'false')}
                                    />
                                  ) : value.type === 'enum' ? (
                                    <Form.Select
                                      value={spellOptions[key] || ''}
                                      onChange={(e) => handleOptionChange(key, e.target.value)}
                                    >
                                      {value.enums.map((enumValue: string) => (
                                        <option key={enumValue} value={enumValue}>{enumValue}</option>
                                      ))}
                                    </Form.Select>
                                  ) : value.type === 'integer' ? (
                                    <Form.Control
                                      type="number"
                                      value={spellOptions[key] || ''}
                                      onChange={(e) => handleOptionChange(key, e.target.value)}
                                      placeholder={value.default ? `Default: ${value.default}` : ''}
                                    />
                                  ) : (
                                    <Form.Control
                                      type="text"
                                      value={spellOptions[key] || ''}
                                      onChange={(e) => handleOptionChange(key, e.target.value)}
                                      placeholder={value.default ? `Default: ${value.default}` : ''}
                                    />
                                  )}
                                </Form.Group>
                              ))}
                            </Form>
                          ) : (
                            <p>No evasion incantations available.</p>
                          )}
                        </Accordion.Body>
                      </Accordion.Item>
                    </Accordion>
                    <Button variant="primary" onClick={handleCastSpell} className="mt-3" disabled={loading}>
                      {loading ? 'Casting...' : 'Cast Spell'}
                    </Button>
                    {castingResult && (
                      <div className="mt-3">
                        <h4>Casting Result:</h4>
                        <pre>{castingResult}</pre>
                      </div>
                    )}
                    <h3>Targets:</h3>
                    {spellDetails.targets && spellDetails.targets.length > 0 ? (
                      <ul>
                        {spellDetails.targets.map((target: any, index: number) => (
                          <li key={index}>{target.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No targets available.</p>
                    )}
                    <h3>Actions:</h3>
                    {spellDetails.actions && spellDetails.actions.length > 0 ? (
                      <ul>
                        {spellDetails.actions.map((action: any, index: number) => (
                          <li key={index}>{action.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No actions available.</p>
                    )}
                  </Col>
                )}
              </Row>
            )}
          </>
        )}

        {showRituals && (
          <div className="mt-5">
            <h2>Active Rituals</h2>
            {loading && <p>Scrying for active rituals...</p>}
            {error && <p className="text-danger">Error: {error}</p>}
            {!loading && !error && activeRituals.length === 0 && <p>No active rituals.</p>}
            {!loading && !error && activeRituals.length > 0 && (
              <ListGroup>
                {activeRituals.map((ritual: any) => (
                  <ListGroup.Item key={ritual.jid}>
                    <h5>Ritual ID: {ritual.jid}</h5>
                    <p>Name: {ritual.name}</p>
                    <p>UUID: {ritual.uuid}</p>
                    <Button variant="danger" size="sm" onClick={() => handleStopRitual(ritual.jid)}>Stop Ritual</Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>
        )}
      </Container>
    </div>
  );
}

export default App;