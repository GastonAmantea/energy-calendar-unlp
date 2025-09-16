import AppointmentForm from "@/components/appointment-form"

export default function Home() {
  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Sistema de Reservas de Laboratorio</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Reserva equipos de laboratorio de manera eficiente con optimización automática del consumo energético
          </p>
        </div>
        <AppointmentForm />
      </div>
    </main>
  )
}
