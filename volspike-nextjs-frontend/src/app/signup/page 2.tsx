import { redirect } from 'next/navigation'

export const metadata = {
    title: 'Sign Up - VolSpike',
    description: 'Create your VolSpike account to access real-time volume spike alerts',
}

export default function SignupPage() {
    redirect('/auth?tab=signup')
}
