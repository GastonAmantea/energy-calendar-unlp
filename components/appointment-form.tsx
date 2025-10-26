"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Zap, Calendar, User, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"

export default function AppointmentForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [laboratories, setLaboratories] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [efficiencyGroups, setEfficiencyGroups] = useState<any[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [totalConsumptionPerHour, setTotalConsumptionPerHour] = useState(0)

  const [selectedLaboratory, setSelectedLaboratory] = useState(null)
  const [selectedMachines, setSelectedMachines] = useState(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null)

  const [currentPage, setCurrentPage] = useState(1)
  const slotsPerPage = 10
  const [formData, setFormData] = useState<any>({
    laboratory_id: "",
    machine_ids: [],
    duration_minutes: 30,
    user_name: "",
    user_email: "",
    appointment_date: "",
    start_time: "",
    end_time: "",
    purpose: "",
    power_consumption: 0,
  })

  // Load laboratories on component mount
  useEffect(() => {
    fetchLaboratories()
  }, [])

  // Load machines when laboratory changes
  useEffect(() => {
    if (formData.laboratory_id) {
      const aux = laboratories?.find((lab) => lab.id == formData.laboratory_id);
      setSelectedLaboratory(aux);
      fetchMachines(formData.laboratory_id)
    }
  }, [formData.laboratory_id])

  // Load time slots when machine and date are selected
  useEffect(() => {
    if (formData.machine_ids.length > 0 && formData.appointment_date && formData.duration_minutes) {
      fetchTimeSlots(formData.appointment_date, formData.laboratory_id, formData.machine_ids, formData.duration_minutes)
    }
  }, [formData.machine_ids, formData.appointment_date, formData.laboratory_id, formData.duration_minutes])

  const fetchLaboratories = async () => {
    try {
      const response = await fetch("/api/laboratories")
      const { data } = await response.json()
      setLaboratories(data)
    } catch (err) {
      setError("Error al cargar los laboratorios")
    }
  }

  const fetchMachines = async (laboratoryId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/machines?laboratory_id=${laboratoryId}`)
      const { data } = await response.json()
      setMachines(data)
    } catch (err) {
      setError("Error al cargar las máquinas")
    } finally {
      setLoading(false)
    }
  }

  const fetchTimeSlots = async (date: string, laboratoryId: string, machineIds: string[], duration: number) => {
    try {
      setLoading(true)
      console.log("[v0] Fetching time slots with params:", { date, laboratoryId, machineIds, duration })

      const machineIdsParam = machineIds.join(",")
      const url = `/api/availability?date=${date}&laboratory_id=${laboratoryId}&machine_ids=${machineIdsParam}&duration=${duration}`
      console.log("[v0] API URL:", url)

      const response = await fetch(url)
      console.log("[v0] API response status:", response.status)

      const { data } = await response.json()
      console.log("[v0] API response data:", data)

      if (!response.ok) {
        throw new Error(data.error || "Error fetching availability")
      }

      if (data.efficiencyGroups) {
        setEfficiencyGroups(data.efficiencyGroups)
        setSelectedGroup(null)
      }
      setCurrentPage(1)
    } catch (err) {
      console.error("[v0] Error fetching time slots:", err)
      setError("Error al verificar disponibilidad")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const result = await response.json()
        console.log("Appointment created:", result)
        try {
          const arrayName = result.data.machines.map((m) => m.name);
          await fetch("/api/mail", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              appointment_date: result.data.appointment_date,
              start_time: result.data.start_time,
              end_time: result.data.end_time,
              laboratory_name: result.data.laboratory.name,
              machine_names: arrayName,
              user_mail: result.data.user_email,
              user_name: result.data.user_name,
              purpose: result.data.purpose,
            }),
          })
        } catch (emailError) {
          console.error("Error sending confirmation email:", emailError)
        }

        setSuccess(true)
        setCurrentStep(4)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Error al crear la cita")
      }
    } catch (err) {
      setError("Error de conexión. Inténtalo de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }
  useEffect(() => {
    if (formData.machine_ids.length > 0) {
      const numericMachineIds = formData.machine_ids.map(id => Number(id));
      const aux = machines.filter((machine) => numericMachineIds.includes(machine.id))
      setSelectedMachines(aux);
      let acum = 0;
      for (const machineId of formData.machine_ids) {
        const machine = machines.find((m) => m.id == machineId);
        if (machine) {
          acum = acum + Number(machine.power_consumption);
        }
      }
      setTotalConsumptionPerHour(acum);
    }else{
      setTotalConsumptionPerHour(0);
    }
  }, [formData.machine_ids]);

  useEffect(() => {
    // Reset time slot selection when changing steps
    setFormData({
      ...formData,
      power_consumption: totalConsumptionPerHour * (formData.duration_minutes / 60),
    })
  }, [totalConsumptionPerHour, formData.duration_minutes ])

  useEffect(() => {
    // Reset time slot selection when changing steps
    if(formData.start_time && formData.end_time){
      const aux = selectedGroup?.slots.find(
    (slot) => slot.start_time === formData.start_time && slot.end_time === formData.end_time);
      setSelectedTimeSlot(aux)
    }
  }, [formData.start_time, formData.end_time])

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {step}
          </div>
          {step < 3 && <div className={`w-12 h-0.5 mx-2 ${step < currentStep ? "bg-primary" : "bg-muted"}`} />}
        </div>
      ))}
    </div>
  )

  if (success) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">¡Cita Reservada Exitosamente!</CardTitle>
          <CardDescription>Tu solicitud de cita ha sido enviada y está confirmada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Detalles de tu cita:</h3>
            <p>
              <strong>Laboratorio:</strong> {selectedLaboratory?.name}
            </p>
            <p>
              <strong>Máquina:</strong> {selectedMachines.map((m) => m.name).join(", ")}
            </p>
            <p>
              <strong>Fecha:</strong> {new Date(formData.appointment_date).toLocaleDateString("es-ES")}
            </p>
            <p>
              <strong>Horario:</strong> {formData.start_time} - {formData.end_time}
            </p>
            <p>
              <strong>Consumo estimado:</strong> {(selectedTimeSlot?.power_consumption + (totalConsumptionPerHour * (formData.duration_minutes / 60))).toFixed(2).replace('.', ',')} kW
            </p>
          </div>
          <Alert>
            <AlertDescription>
              Recibirás un correo electrónico de confirmación en {formData.user_email}
            </AlertDescription>
          </Alert>
          <Button onClick={() => window.location.reload()} className="w-full">
            Hacer otra reserva
          </Button>
        </CardContent>
      </Card>
    )
  }

  const durationOptions = [30, 60, 90, 120, 150, 180, 210, 240]

  const currentSlots = selectedGroup
    ? selectedGroup.slots.slice((currentPage - 1) * slotsPerPage, currentPage * slotsPerPage)
    : []
  const totalPages = selectedGroup ? Math.ceil(selectedGroup.slots.length / slotsPerPage) : 0

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Reserva de Laboratorio</CardTitle>
        <CardDescription className="text-center">
          Sistema de reservas con optimización de consumo energético
        </CardDescription>
        {renderStepIndicator()}
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-6 border-destructive">
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Laboratory and Machine Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Seleccionar Equipos</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="laboratory" style={{marginBottom:"1rem"}}>Laboratorio</Label>
                  <Select
                    value={formData.laboratory_id}
                    onValueChange={(value) => {
                      setFormData({ ...formData, laboratory_id: value, machine_ids: [] })
                      setMachines([])
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un laboratorio" />
                    </SelectTrigger>
                    <SelectContent>
                      {laboratories?.map((lab) => (
                        <SelectItem key={lab.id} value={String(lab.id)}>
                          <div>
                            <div className="font-medium">{lab.name}</div>
                            <div className="text-sm text-muted-foreground">{lab.location}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.laboratory_id && (
                  <div>
                    <Label>Máquinas/Equipos (selecciona una o más)</Label>
                    {loading ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2">Cargando máquinas...</span>
                      </div>
                    ) : (
                      <div className="space-y-2 mt-2">
                          {machines.map((machine) => (
                          <div key={machine.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                            <Checkbox
                              id={machine.id.toString()}
                              checked={formData.machine_ids.includes(machine.id.toString())}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    machine_ids: [...formData.machine_ids, machine.id.toString()],
                                  })
                                } else {
                                  setFormData({
                                    ...formData,
                                    machine_ids: formData.machine_ids.filter((id) => id !== machine.id.toString()),
                                  })
                                }
                              }}
                            />
                            <label
                              htmlFor={machine.id.toString()}
                              className="flex-1 flex items-center justify-between cursor-pointer"
                            >
                              <span className="font-medium">{machine.name}</span>
                              <Badge variant="secondary">{machine.power_consumption.toString()} kW</Badge>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {formData.machine_ids.length > 0 && (
                  <div>
                    <Label htmlFor="duration">Duración (minutos)</Label>
                    <Select
                      value={formData.duration_minutes.toString()}
                      onValueChange={(value) => setFormData({ ...formData, duration_minutes: Number.parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona la duración" />
                      </SelectTrigger>
                      <SelectContent>
                        {durationOptions.map((duration) => (
                          <SelectItem key={duration} value={duration.toString()}>
                            {duration} minutos ({(duration / 60).toFixed(duration % 60 === 0 ? 0 : 1)} horas)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!formData.laboratory_id || formData.machine_ids.length === 0 || !formData.duration_minutes}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Date and Time Selection */}
          {currentStep === 2 && (
            <div className="space-y-6">

              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Consumo estimado del turno:</h3>
                <span className="text-sm text-muted-foreground">
                   {totalConsumptionPerHour * (formData.duration_minutes / 60)} kW
                </span>

              </div>

              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Fecha y Hora</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="date">Fecha de la cita</Label>
                  <Input
                    type="date"
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>

                {formData.appointment_date && (
                  <div>
                    {!selectedGroup ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Niveles de eficiencia disponibles</Label>
                          {efficiencyGroups.length > 0 && (
                            <span className="text-sm text-muted-foreground">
                              {efficiencyGroups.reduce((total, group) => total + group.slots.length, 0)} opciones
                              encontradas
                            </span>
                          )}
                        </div>
                        {loading ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="ml-2">Verificando disponibilidad...</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {efficiencyGroups.map((group) => (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => setSelectedGroup(group)}
                                className="p-4 rounded-lg border text-left transition-colors hover:border-primary/50 border-border"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium text-base mb-1">
                                      {group.label} - {group.time_range}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {group.slots.length} horarios disponibles
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1">
                                      <Zap className="h-4 w-4 text-secondary" />
                                      <span className="text-sm font-medium">
                                        {group.average_power_consumption.toFixed(1).replace('.', ',')} kW
                                      </span>
                                    </div>
                                    {group.power_spike_percentage > 0 ? (
                                      <Badge variant="outline" className="text-xs">
                                        +{group.power_spike_percentage}%
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">
                                        Óptimo
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedGroup(null)
                                setFormData({ ...formData, start_time: "", end_time: "" })
                              }}
                            >
                              <ArrowLeft className="h-4 w-4 mr-1" />
                              Volver
                            </Button>
                            <Label>{selectedGroup.label} - Horarios específicos</Label>
                          </div>
                          <span className="text-sm text-muted-foreground">{selectedGroup.slots.length} opciones</span>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {currentSlots.map((slot) => (
                            <button
                              key={`${slot.start_time}-${slot.end_time}`}
                              type="button"
                              disabled={!slot.available}
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  start_time: slot.start_time,
                                  end_time: slot.end_time,
                                })
                              }
                              className={`p-4 rounded-lg border text-left transition-colors ${
                                formData.start_time === slot.start_time && formData.end_time === slot.end_time
                                  ? "border-primary bg-primary/10"
                                  : slot.available
                                    ? "border-border hover:border-primary/50"
                                    : "border-muted bg-muted cursor-not-allowed opacity-50"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-base">
                                    {slot.start_time} - {slot.end_time}
                                  </div>
                                  {!slot.available && slot.reason && (
                                    <div className="text-sm text-muted-foreground mt-1">{slot.reason}</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1">
                                    <Zap className="h-4 w-4 text-secondary" />
                                    <span className="text-sm font-medium">{slot.power_consumption.toFixed(2).replace('.', ',')} kW</span>
                                  </div>
                                  {slot.power_spike_percentage > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{slot.power_spike_percentage.toFixed(0).replace('.', ',')}%
                                    </Badge>
                                  )}
                                  {slot.power_spike_percentage === 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      Óptimo
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>

                        {totalPages > 1 && (
                          <div className="flex items-center justify-between mt-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Anterior
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Página {currentPage} de {totalPages}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                            >
                              Siguiente
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={prevStep}>
                  Anterior
                </Button>
                <Button type="button" onClick={nextStep} disabled={!formData.start_time || !formData.end_time}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Personal Information */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Información Personal</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                    placeholder="Tu nombre completo"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.user_email}
                    onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                    placeholder="tu.email@universidad.edu"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="purpose">Propósito de la reserva</Label>
                  <Textarea
                    id="purpose"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    placeholder="Describe brevemente el propósito de tu reserva..."
                    rows={3}
                    required
                  />
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Resumen de tu reserva:</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>Laboratorio:</strong> {selectedLaboratory?.name}
                  </p>
                  <p>
                    <strong>Máquina:</strong> {selectedMachines.map((m) => m.name).join(", ")}
                  </p>
                  <p>
                    <strong>Duración:</strong> {formData.duration_minutes} minutos
                  </p>
                  <p>
                    <strong>Fecha:</strong> {new Date(formData.appointment_date).toLocaleDateString("es-ES")}
                  </p>
                  <p>
                    <strong>Horario:</strong> {formData.start_time} - {formData.end_time}
                  </p>
                  <p>
                  </p>
                  {selectedTimeSlot && selectedTimeSlot.power_spike_percentage > 0 && (
                    <p>
                      <strong>Incremento energético:</strong> +{selectedTimeSlot.power_spike_percentage.toFixed(0).replace('.', ',')}% vs
                      opción óptima
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={prevStep}>
                  Anterior
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !formData.user_name || !formData.user_email || !formData.purpose}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reservando...
                    </>
                  ) : (
                    "Confirmar Reserva"
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
